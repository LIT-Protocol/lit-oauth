// import LitJsSdk from "lit-js-sdk";
// import axios from "axios";

export default async function (fastify, opts) {
  fastify.post('/api/shopify/saveCondition', async (request, reply) => {

    return 'success connecting to lit shopify';
  })
}
