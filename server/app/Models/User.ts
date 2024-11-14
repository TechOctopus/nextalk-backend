import { DateTime } from 'luxon'
import Hash from '@ioc:Adonis/Core/Hash'
import {
  column,
  beforeSave,
  BaseModel,
  hasMany,
  HasMany,
  manyToMany,
  ManyToMany,
} from '@ioc:Adonis/Lucid/Orm'
import Channel from 'App/Models/Channel'
import Message from 'App/Models/Message'
import Action from 'App/Models/Action'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  public id: number

  @column()
  public firstName: string

  @column()
  public lastName: string

  @column()
  public username: string

  @column()
  public email: string

  @column()
  public status: 'online' | 'offline' | 'dnd'

  @column()
  public notifications: 'enabled' | 'disabled' | 'mentions'

  @column({ serializeAs: null })
  public password: string

  @column()
  public rememberMeToken: string | null

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime

  @beforeSave()
  public static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password)
    }
  }

  @hasMany(() => Message, {
    foreignKey: 'createdBy',
  })
  public sentMessages: HasMany<typeof Message>

  @hasMany(() => Action, {
    foreignKey: 'userId',
  })
  declare actions: HasMany<typeof Action>

  @hasMany(() => Action, {
    foreignKey: 'performerId',
  })
  declare performedActions: HasMany<typeof Action>

  @manyToMany(() => Message)
  declare mentions: ManyToMany<typeof Message>

  @manyToMany(() => Channel)
  public channels: ManyToMany<typeof Channel>
}
