# Testing

## Sample `curl` commands for testing

### POST /api/transfer

```sh
curl -X POST http://localhost:8888/api/transfer \
-H "Content-Type: application/json" \
-d '{
  "amount": 100000,
  "token": null,
  "principal-1": "SP1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2XG1V316",
  "principal-2": "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z",
  "balance-1": 1300000,
  "balance-2": 1700000,
  "nonce": 1,
  "hashed-secret": null,
  "signature": "bdd4cbc726acefac6d47ba86cb7f3324ef68fe45af131e08d3f0c3f5dcb184271f205d8baf09a078076afcebfbd754b2c24d4a2fef0448909bacafdcd86d3b3900",
  "next-hops": null,
  "next-hop": null
}'
```

### POST /api/deposit

```sh
curl -X POST http://localhost:8888/api/deposit \
-H "Content-Type: application/json" \
-d '{
  "amount": 100000,
  "token": null,
  "principal-1": "SP1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2XG1V316",
  "principal-2": "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z",
  "balance-1": 1400000,
  "balance-2": 1700000,
  "nonce": 2,
  "signature": "58215e78d6458ee5c0954f89f3571f73b48317c63ab13e8bea01add5a036131c1078298f1b5477176f414b9bff1405112cb1b81176db9ad4770c4bfaabbb68a400"
}'
```

### POST /api/withdraw

```sh
curl -X POST http://localhost:8888/api/withdraw \
-H "Content-Type: application/json" \
-d '{
  "amount": 100000,
  "token": null,
  "principal-1": "SP1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2XG1V316",
  "principal-2": "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z",
  "balance-1": 1200000,
  "balance-2": 1700000,
  "nonce": 2,
  "signature": "ff8d60b0e1c905f4ccd5a0257d883382e1edeb3326aa5d41e80f3d4eec5768917d0bfcca9977a4e2595ee2e662c03f8606611b906056ed184ca359db9588c33400"
}'
```

### POST /api/close

```sh
curl -X POST http://localhost:8888/api/close \
-H "Content-Type: application/json" \
-d '{
  "amount": 100000,
  "token": null,
  "principal-1": "SP1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2XG1V316",
  "principal-2": "SP1691R3BDYFTGA0638KRB4CBRVFX7X1HF0FQSX5Z",
  "balance-1": 1300000,
  "balance-2": 1700000,
  "nonce": 2,
  "signature": "d24952852a652979915c0d3b46a859585f7d60f1d29f219b0035e6a18e62ea0e1783e4d2af756665b217d6e589a871bc22db34018e7b7f48f9de980282e0479401"
}'
```