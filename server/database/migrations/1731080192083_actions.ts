import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'actions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('channel_id').unsigned().references('channels.id').onDelete('CASCADE')
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE')
      table.integer('performer_id').unsigned().references('users.id').onDelete('CASCADE')

      table
        .enum('action', ['invite', 'join', 'revok', 'ban', 'unban', 'create', 'kick'])
        .notNullable()

      /**
       * Uses timestamptz for PostgreSQL and DATETIME2 for MSSQL
       */
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true })
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
