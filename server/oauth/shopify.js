// import LitJsSdk from "lit-js-sdk";
// import axios from "axios";

export default async function (fastify, opts) {
  fastify.post('/api/shopify/saveCondition', async (request, reply) => {
    console.log('shopify test')

    return 'success connecting to lit shopify locally';
  })

  fastify.post('/api/shopify/getCustomer', async (request, reply) => {

    console.log('get Customer')

    return 'success connecting to get customer';
  })

  fastify.post('/api/shopify/deleteCustomer', async (request, reply) => {

    console.log('delete customer shopify')

    return 'success connecting to delete customer';
  })

  fastify.post('/api/shopify/deleteStore', async (request, reply) => {

    console.log('shopify delete store')

    return 'success connecting to delete store';
  })
}
