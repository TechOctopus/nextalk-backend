import type { WsContextContract } from '@ioc:Ruby184/Socket.IO/WsContext'
import User from 'App/Models/User'

export default class ChannelController {
  public async typing({ socket, auth }: WsContextContract, text: string) {
    const user = await User.findOrFail(auth.user!.id)
    socket.broadcast.emit('typing', user, text)
  }

  public async stopTyping({ socket, auth }: WsContextContract) {
    const user = await User.findOrFail(auth.user!.id)
    socket.broadcast.emit('stopTyping', user)
  }
}
