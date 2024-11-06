import BaseSeeder from '@ioc:Adonis/Lucid/Seeder'
import User from 'App/Models/User'

export default class extends BaseSeeder {
  public async run() {
    await User.createMany([
      {
        firstName: 'Heorhi',
        lastName: 'Davydau',
        username: 'heorhidavydau',
        email: 'h@g.com',
        password: '12345678',
      },
      {
        firstName: 'Artem',
        lastName: 'Gurin',
        username: 'artemgurin',
        email: 'a@g.com',
        password: '12345678',
      },
    ])
  }
}
