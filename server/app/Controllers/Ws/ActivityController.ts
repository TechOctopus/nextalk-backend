import type { WsContextContract } from '@ioc:Ruby184/Socket.IO/WsContext'
import User from 'App/Models/User'

export default class ActivityController {
  private getUserRoom(user: User): string {
    return `user:${user.id}`
  }

  public async onConnected({ socket, auth, logger }: WsContextContract) {
    const user = await User.findOrFail(auth.user!.id)
    user.status = 'online'
    await user.save()

    socket.emit('user:connected')

    // all connections for the same authenticated user will be in the room
    const room = this.getUserRoom(auth.user!)
    const userSockets = await socket.in(room).allSockets()

    // this is first connection for given user
    if (userSockets.size === 0) {
      socket.broadcast.emit('user:online', auth.user)
    }

    // add this socket to user room
    socket.join(room)
    // add userId to data shared between Socket.IO servers
    // https://socket.io/docs/v4/server-api/#namespacefetchsockets
    socket.data.userId = auth.user!.id

    const allSockets = await socket.nsp.except(room).fetchSockets()
    const onlineIds = new Set<number>()

    for (const remoteSocket of allSockets) {
      onlineIds.add(remoteSocket.data.userId)
    }

    const onlineUsers = await User.findMany([...onlineIds])

    socket.emit('user:list', onlineUsers)

    logger.info('new websocket connection')
  }

  // see https://socket.io/get-started/private-messaging-part-2/#disconnection-handler
  public async onDisconnected({ socket, auth, logger }: WsContextContract, reason: string) {
    const user = await User.findOrFail(auth.user!.id)
    user.status = 'offline'
    await user.save()

    const room = this.getUserRoom(auth.user!)
    const userSockets = await socket.in(room).allSockets()

    // user is disconnected
    if (userSockets.size === 0) {
      // notify other users
      socket.broadcast.emit('user:offline', auth.user)
    }

    logger.info('websocket disconnected', reason)
  }

  public async userNotifications(
    { auth }: WsContextContract,
    notifications: User['notifications']
  ) {
    const user = await User.findOrFail(auth.user!.id)
    user.notifications = notifications
    await user.save()
  }

  public async userStatus({ socket, auth }: WsContextContract, status: User['status']) {
    const user = await User.findOrFail(auth.user!.id)
    user.status = status
    await user.save()

    socket.broadcast.emit('user:status', { id: user.id, status })
  }
}
