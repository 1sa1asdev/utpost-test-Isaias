import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Utan den här raden laddar Vitest två utgåvor av paketet graphql (en för våra filer, en för
  // graphql-yoga). Då är GraphQLError två olika klasser, instanceof säger nej och yoga döljer
  // varje fel bakom INTERNAL_SERVER_ERROR. Måste stå bredvid test, inte inuti.
  ssr: { resolve: { conditions: ['module', 'node'] } },
  test: {
    include: ['src/**/*.test.js'],
    testTimeout: 10000, // första anslutningen mot Mongo kan ta tid
  },
});
