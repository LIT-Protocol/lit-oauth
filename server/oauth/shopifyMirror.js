// import LitJsSdk from "lit-js-sdk";
// import axios from "axios";
import axios from 'axios';

export default async function (fastify, opts) {
  fastify.post('/api/shopify/saveConditionMirror', async (request, reply) => {

    await axios
      .delete(`https://localhost:4000/api/shopify/saveCondition`)
      .then((res) => {
        console.log('shopify mirror');
        return res;
      })
      .catch((err) => {
        console.log("DELETE ERR", err);
      });

    return 'success connecting to lit shopify';
  })

  fastify.post('/api/shopify/getCustomerMirror', async (request, reply) => {

    console.log('get Customer')

    return 'success connecting to get customer';
  })

  fastify.post('/api/shopify/deleteCustomerMirror', async (request, reply) => {

    console.log('delete customer shopify')

    return 'success connecting to delete customer';
  })

  fastify.post('/api/shopify/deleteStoreMirror', async (request, reply) => {

    console.log('shopify delete store')

    return 'success connecting to delete store';
  })
}
