import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import Channel from 'App/Models/Channel'
import { DateTime } from 'luxon'

export default class extends BaseSeeder {
  public async run() {
    await Channel.createMany([
      {
        adminId: 1,
        name: 'channel_to_delete',
        createdAt: DateTime.fromISO('2021-09-01T00:00:00'),
      },
    ])
  }
}
