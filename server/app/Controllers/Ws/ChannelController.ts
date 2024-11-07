import type { WsContextContract } from '@ioc:Ruby184/Socket.IO/WsContext'
import Channel from 'App/Models/Channel'
import User from 'App/Models/User'

export default class ChannelController {
  private getUserRoom(user: User): string {
    return `user:${user.id}`
  }

  public async loadChannels({ socket, auth }: WsContextContract) {
    const userRoom = this.getUserRoom(auth.user!)
    socket.join(userRoom)

    const channels = await Channel.query()
      .where('adminId', auth.user!.id)
      .orWhereHas('users', (query) => {
        query.where('user_id', auth.user!.id)
      })

    return channels.map((channel) => channel.serialize())
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

      await channelExists.related('users').attach([auth.user!.id])
      return channelExists.serialize()
    }

    const newChannel = await Channel.create({
      name: channelName,
      adminId: auth.user!.id,
      isPrivate,
    })

    socket.join(channelName)

    return newChannel.serialize()
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

    const user = await User.findByOrFail('username', userName)
    await channel.related('users').attach([user.id])

    const userRoom = this.getUserRoom(user)
    socket.to(userRoom).emit('invite', channel.serialize())

    return channel.serialize()
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

    const userRoom = this.getUserRoom(user)
    socket.to(userRoom).emit('revoke', channel.serialize())

    return channel.serialize()
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
}
