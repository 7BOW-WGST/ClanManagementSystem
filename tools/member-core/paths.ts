import { resolve } from 'node:path'

export const toolDir = import.meta.dir
export const defaultRosterPath = resolve(toolDir, '../discord-parser/output/discord-members.json')
export const defaultMemberDbPath = resolve(toolDir, './output/members.sqlite')
export const defaultNicknameCsvPath = resolve(toolDir, './input/nicknames.csv')
