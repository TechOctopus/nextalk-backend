import type {
  MessageRepositoryContract,
  SerializedMessage,
} from '@ioc:Repositories/MessageRepository'
import Channel from 'App/Models/Channel'
import User from 'App/Models/User'
import Action from 'App/Models/Action'

export default class MessageRepository implements MessageRepositoryContract {
  private parseMentions(message: string): string[] {
    return message
      .split(' ')
      .filter((word) => word.startsWith('@'))
      .map((mention) => mention.slice(1, mention.length))
      .filter((mention) => mention.length !== 0)
  }

  private highlightMentions(message: string): string {
    return message
      .split(' ')
      .map((word: string) => {
        return word.startsWith('@') && word.slice(1, word.length).length > 0
          ? `<strong class="mention">${word}</strong>`
          : word
      })
      .join(' ')
  }

  public async getAll(channelName: string): Promise<SerializedMessage[]> {
    const channel = await Channel.query()
      .where('name', channelName)
      .preload('messages', (messagesQuery) => messagesQuery.preload('author'))
      .firstOrFail()

    const messagesData = await Promise.all(
      channel.messages.map(async (message) => {
        const mentions = await message.related('mentions').query()
        return {
          id: message.id,
          author: message.author.serialize(),
          content: message.content,
          mentions: mentions,
          createdAt: message.createdAt.toString(),
          updatedAt: message.updatedAt.toString(),
          channelId: channel.id,
        } as SerializedMessage
      })
    )

    return messagesData
  }

  public async create(
    channelName: string,
    userId: number,
    content: string
  ): Promise<{ message: SerializedMessage; isChannelJoined: boolean }> {
    const channel = await Channel.findByOrFail('name', channelName)
    const message = await channel
      .related('messages')
      .create({ createdBy: userId, content: this.highlightMentions(content) })
    await message.load('author')

    const mentions = this.parseMentions(content)
    const mentionsUsers = [] as User[]

    if (mentions.length > 0) {
      await Promise.all(
        mentions.map(async (mention) => {
          try {
            const mentionedUser = await User.findByOrFail('username', mention)
            await message.related('mentions').attach([mentionedUser.id])
            mentionsUsers.push(mentionedUser)
          } catch (error) {
            console.log(error)
          }
        })
      )
    }

    // Cheak if user is invited to channel, after that send message it joined
    const user = await User.find(userId)
    const action = await Action.query()
      .where('userId', user!.id)
      .where('channelId', channel.id)
      .orderBy('created_at', 'desc')
      .first()

    if (action?.action === 'invite') {
      await Action.create({
        userId: user!.id,
        performerId: user!.id,
        channelId: channel.id,
        action: 'join',
      })

      return {
        message: {
          id: message.id,
          author: message.author.serialize(),
          content: message.content,
          mentions: mentionsUsers,
          createdAt: message.createdAt.toString(),
          updatedAt: message.updatedAt.toString(),
          channelId: channel.id,
        } as SerializedMessage,
        isChannelJoined: true,
      }
    }

    return {
      message: {
        id: message.id,
        author: message.author.serialize(),
        content: message.content,
        mentions: mentionsUsers,
        createdAt: message.createdAt.toString(),
        updatedAt: message.updatedAt.toString(),
        channelId: channel.id,
      } as SerializedMessage,
      isChannelJoined: false,
    }
  }
}
