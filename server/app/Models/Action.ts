import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, BelongsTo } from '@ioc:Adonis/Lucid/Orm'
import User from 'App/Models/User'
import Channel from 'App/Models/Channel'

export default class Action extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public channelId: number

  @column()
  public userId: number

  @column()
  public action: 'invite' | 'join' | 'revoke' | 'ban' | 'unban' | 'create' | 'kick'

  @column()
  public performerId: number

  @belongsTo(() => Channel, {
    foreignKey: 'channelId',
  })
  public channel: BelongsTo<typeof Channel>

  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  public user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'performerId',
  })
  public performer: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
