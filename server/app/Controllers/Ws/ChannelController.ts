import type { WsContextContract } from '@ioc:Ruby184/Socket.IO/WsContext'
import Channel from 'App/Models/Channel'

export default class ChannelController {
  public async loadChannels({ auth }: WsContextContract) {
    const channels = await Channel.query()
      .where('adminId', auth.user!.id)
      .orWhereHas('users', (query) => {
        query.where('user_id', auth.user!.id)
      })

    return channels.map((channel) => channel.serialize())
  }

  public async joinChannel({ socket }: WsContextContract, channelName: string) {
    const newChannel = await Channel.create({ name: channelName })
    socket.join(channelName)
    return newChannel.serialize()
  }

  public async quitChannel({ socket }: WsContextContract, channelName: string) {
    // remove user from the channel
    socket.leave(channelName)
  }
}
