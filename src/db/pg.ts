import { types } from 'pg'

// Return DATE columns as plain 'YYYY-MM-DD' strings so calendar dates never shift timezone.
types.setTypeParser(types.builtins.DATE, (value) => value)
