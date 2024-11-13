import type { WsContextContract } from '@ioc:Ruby184/Socket.IO/WsContext'
import Channel from 'App/Models/Channel'
import User from 'App/Models/User'
import Action from 'App/Models/Action'
import Message from 'App/Models/Message'

export default class ChannelController {
  private getUserRoom(user: User): string {
    return `user:${user.id}`
  }

  public async loadChannels({ socket, auth }: WsContextContract) {
    const userRoom = this.getUserRoom(auth.user!)
    socket.join(userRoom)

    let channels = await Channel.query()
      .where('adminId', auth.user!.id)
      .orWhereHas('users', (query) => {
        query.where('user_id', auth.user!.id)
      })
      .preload('actions', (query) => {
        query.where('user_id', auth.user!.id).orderBy('created_at', 'desc').limit(1)
      })

    //ak nie je kanál aktívny (nie je pridaná nová správa) viac ako 30 dní, kanál prestáva existovať (následne je možné použiť channelName kanála pre "nový" kanál)

    const toDeleteNames = [] as string[]

    await Promise.all(
      channels.map(async (channel) => {
        const lastMessage = await Message.query()
          .where('channel_id', channel.id)
          .orderBy('created_at', 'desc')
          .limit(1)

        if (lastMessage.length === 0) {
          const channelCreatedAt = channel.serialize().createdAt
          const diff = Math.abs(new Date().getTime() - new Date(channelCreatedAt).getTime())
          const diffDays = Math.ceil(diff / (1000 * 3600 * 24))

          if (diffDays > 30) {
            toDeleteNames.push(channel.name)
          }

          return
        }

        const diff = Math.abs(
          new Date().getTime() - new Date(lastMessage[0].serialize().createdAt).getTime()
        )
        const diffDays = Math.ceil(diff / (1000 * 3600 * 24))

        if (diffDays > 30) {
          toDeleteNames.push(channel.name)
        }
      })
    )

    if (toDeleteNames.length > 0) {
      await Promise.all(
        toDeleteNames.map(async (channelName) => {
          const channel = await Channel.query().where('name', channelName).firstOrFail()

          await Promise.all([
            channel.related('messages').query().delete(),
            channel.related('users').detach(),
          ])
          await channel.delete()
        })
      )

      channels = await Channel.query()
        .where('adminId', auth.user!.id)
        .orWhereHas('users', (query) => {
          query.where('user_id', auth.user!.id)
        })
        .preload('actions', (query) => {
          query.where('user_id', auth.user!.id).orderBy('created_at', 'desc').limit(1)
        })
    }

    return channels.map((channel) => {
      return {
        id: channel.id,
        name: channel.name,
        isPrivate: channel.isPrivate,
        adminId: channel.adminId,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
        status: channel.actions[0]?.action,
      }
    })
  }

  public async joinChannel(
    { socket, auth }: WsContextContract,
    channelName: string,
    isPrivate: boolean
  ) {
    const channelExists = await Channel.query().where('name', channelName).first()

    if (channelExists) {
      if (channelExists.isPrivate) {
        return { error: 'Channel name already taken.' }
      }

      const userStatus = await Action.query()
        .where('userId', auth.user!.id)
        .where('channelId', channelExists.id)
        .orderBy('created_at', 'desc')
        .first()

      if (userStatus?.action === 'ban') {
        return { error: 'You are banned from this channel.' }
      }

      await channelExists.related('users').attach([auth.user!.id])

      await Action.create({
        userId: auth.user!.id,
        performerId: auth.user!.id,
        channelId: channelExists.id,
        action: 'join',
      })

      const toSend = {
        ...channelExists.serialize(),
        status: 'join',
      }

      return toSend
    }

    const newChannel = await Channel.create({
      name: channelName,
      adminId: auth.user!.id,
      isPrivate,
    })

    await Action.create({
      userId: auth.user!.id,
      channelId: newChannel.id,
      performerId: auth.user!.id,
      action: 'create',
    })

    const toSend = {
      ...newChannel.serialize(),
      status: 'create',
    }

    socket.join(channelName)

    return toSend
  }

  public async inviteUser(
    { socket, auth }: WsContextContract,
    userName: string,
    channelId: string
  ) {
    const channel = await Channel.findOrFail(channelId)

    if (channel.isPrivate && channel.adminId !== auth.user!.id) {
      return { error: 'You are not authorized to invite users to this channel' }
    }

    if (channel.adminId !== auth.user!.id) {
      const userStatus = await Action.query()
        .where('userId', auth.user!.id)
        .where('channelId', channel.id)
        .orderBy('created_at', 'desc')
        .first()

      if (userStatus?.action === 'ban') {
        return { error: 'You are banned from this channel.' }
      }
    }

    const user = await User.findByOrFail('username', userName)
    await channel.related('users').attach([user.id])
    await Action.create({
      userId: user.id,
      performerId: auth.user!.id,
      channelId: channel.id,
      action: 'invite',
    })

    const toSend = {
      ...channel.serialize(),
      status: 'invite',
    }

    const userRoom = this.getUserRoom(user)
    socket.to(userRoom).emit('invite', toSend)

    return toSend
  }

  public async revokeUser(
    { socket, auth }: WsContextContract,
    userName: string,
    channelId: string
  ) {
    const channel = await Channel.findOrFail(channelId)

    if (!channel.isPrivate && channel.adminId !== auth.user!.id) {
      return { error: 'You are not authorized to revoke users from this channel' }
    }

    const user = await User.findByOrFail('username', userName)
    await channel.related('users').detach([user.id])
    await Action.create({
      userId: user.id,
      performerId: auth.user!.id,
      channelId: channel.id,
      action: 'revoke',
    })

    const toSend = {
      ...channel.serialize(),
      status: 'revoke',
    }

    const userRoom = this.getUserRoom(user)
    socket.to(userRoom).emit('revoke', toSend)

    return toSend
  }

  public async quitChannel({ socket, auth }: WsContextContract, channelId: string) {
    const channel = await Channel.query().where('id', channelId).firstOrFail()
    if (channel.adminId !== auth.user!.id) {
      return { error: 'You are not authorized to quit this channel' }
    }

    await Promise.all([
      channel.related('messages').query().delete(),
      channel.related('users').detach(),
    ])

    await channel.delete()

    socket.leave(channel.name)
    socket.nsp.emit('quit', channel.serialize())

    return channel.serialize()
  }

  public async cancelChannel({ socket, auth }: WsContextContract, channelId: string) {
    const channel = await Channel.query().where('id', channelId).firstOrFail()
    if (channel.adminId === auth.user!.id) {
      return this.quitChannel({ socket, auth } as WsContextContract, channelId)
    }

    await channel.related('users').detach([auth.user!.id])
    socket.leave(channel.name)
    socket.emit('cancel', channel.serialize())

    return channel.serialize()
  }

  public async kickUser({ socket, auth }: WsContextContract, userName: string, channelId: string) {
    const channel = await Channel.findOrFail(channelId)

    if (channel.isPrivate) {
      return { error: 'Kick is not allowed in private channels' }
    }

    const user = await User.findByOrFail('username', userName)
    const userRoom = this.getUserRoom(user)

    await channel.related('users').detach([user.id])

    if (channel.adminId === auth.user!.id) {
      await Action.create({
        userId: user.id,
        performerId: auth.user!.id,
        channelId: channel.id,
        action: 'ban',
      })

      const toSend = {
        ...channel.serialize(),
        status: 'ban',
      }

      socket.to(userRoom).emit('ban', toSend)
      return toSend
    }

    await Action.create({
      userId: user.id,
      performerId: auth.user!.id,
      channelId: channel.id,
      action: 'kick',
    })

    const userActions = await Action.query()
      .where('userId', user.id)
      .where('action', 'kick')
      .where('channelId', channel.id)

    const kickCount = new Set(userActions.map((action) => action.performerId)).size

    const toSend = {
      ...channel.serialize(),
      status: 'kick',
    }
    if (kickCount >= 3) {
      await channel.related('users').detach([user.id])
      await Action.create({
        userId: user.id,
        performerId: auth.user!.id,
        channelId: channel.id,
        action: 'ban',
      })
      toSend.status = 'ban'
      socket.to(userRoom).emit('ban', toSend)
    } else {
      socket.to(userRoom).emit('kick', toSend)
    }

    return toSend
  }

  public async listUsers({ auth }: WsContextContract, channelId: string) {
    const channel = await Channel.query().where('id', channelId).firstOrFail()
    const users = await channel.related('users').query()

    if (channel.adminId !== auth.user!.id && !users.find((user) => user.id === auth.user!.id)) {
      return { error: 'You are not authorized to list users in this channel' }
    }

    const admin = await User.findOrFail(channel.adminId)
    const toSend = users.map((user) => ({ user: user.serialize(), role: 'member' }))
    toSend.unshift({ user: admin.serialize(), role: 'admin' })
    return toSend
  }
}
