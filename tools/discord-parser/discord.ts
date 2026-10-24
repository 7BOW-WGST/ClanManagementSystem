import { REST } from '@discordjs/rest'
import {
  Routes,
  type APIGuild,
  type APIGuildMember,
  type APIUser,
} from 'discord-api-types/v10'
import type { FetchMembersOptions } from './types'

export interface DiscordSourceOptions {
  token: string
  apiVersion: number
  pageSize: number
}

// Minimal REST wrapper around @discordjs/rest. The library handles rate-limit buckets.
export class DiscordSource {
  private readonly rest: REST
  private readonly pageSize: number

  constructor(options: DiscordSourceOptions) {
    this.rest = new REST({ version: String(options.apiVersion) }).setToken(options.token)
    this.pageSize = options.pageSize
  }

  async fetchCurrentUser(): Promise<APIUser> {
    return (await this.rest.get(Routes.user())) as APIUser
  }

  async fetchGuild(guildId: string): Promise<APIGuild> {
    return (await this.rest.get(Routes.guild(guildId))) as APIGuild
  }

  // Paginate with `after` (highest user id from the previous page).
  async fetchGuildMembers(
    guildId: string,
    options: FetchMembersOptions = {},
  ): Promise<APIGuildMember[]> {
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
      throw new Error('Member fetch limit must be a positive integer.')
    }

    const members: APIGuildMember[] = []
    let after: string | undefined

    while (true) {
      const remaining =
        options.limit === undefined ? this.pageSize : options.limit - members.length
      const pageLimit = Math.min(this.pageSize, remaining)
      if (pageLimit <= 0) {
        break
      }

      const query = new URLSearchParams({ limit: String(pageLimit) })
      if (after !== undefined) {
        query.set('after', after)
      }

      const page = (await this.rest.get(Routes.guildMembers(guildId), {
        query,
      })) as APIGuildMember[]
      if (!Array.isArray(page)) {
        throw new Error('Discord returned an unexpected guild-member response.')
      }

      members.push(...page)
      if (page.length < pageLimit) {
        break
      }

      const last = page[page.length - 1]
      if (last === undefined) {
        break
      }
      after = last.user.id
    }

    return members
  }
}
