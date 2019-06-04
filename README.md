# 酒 SkyMake

#### SkyVerge WordPress and WooCommerce plugin build & deploy tool

Requires node 8.9.4+

### Installation:

```
$ npm i skyverge/sake
```

### Update to latest

```
$ npm update skyverge/sake
```

**Note:** Sake is currently not versioned, but a specific commit may be provided when installing, such as `skyverge/sake#0d5ec6622a6845f695d9e8ed04f4db08bd0e4986`.

## Running tasks

Ensure you're in a plugin directory (ie `wc-plugins/woocommerce-address-validation`). Then type `npx sake {task}`, for example:

```
$ npx sake build
```

You can also [pass options](https://github.com/skyverge/sake/wiki/CLI-options) to tasks.

### See a list of available tasks

```
$ npx sake --tasks
```

## Developing

1. Make sure to read & understand [configuration](https://github.com/skyverge/sake/wiki/Configuration).
2. Use [Standard JS](https://standardjs.com/) coding style.
3. Test against forks of the development and production repos.
