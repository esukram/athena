module.exports = {
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2,
  "plugins": [require.resolve("@trivago/prettier-plugin-sort-imports")],
  "importOrder": ["^react$", "^@(?!athena)(.*)/(.*)$", "^@athena/(.*)$", "^components/(.*)$", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
