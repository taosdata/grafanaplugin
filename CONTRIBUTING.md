# CONTRIBUTING

Start your Grafana plugin develop by following the [6 tips for improving your Grafana plugin before you publish](https://grafana.com/blog/2021/01/21/6-tips-for-improving-your-grafana-plugin-before-you-publish/).


## Development Setup

This plugin requires node >=12.0.0 and Go >= 1.7 .

```sh
npm install -g yarn
yarn install
yarn build
```

In order to use the build target provided by the plug-in SDK, you can use the [mage](https://github.com/magefile/mage) build file. After the build is complete, copy mage to $PATH.

```sh
git clone https://github.com/magefile/mage ../mage
cd ../mage
go run bootstrap.go
```

Run the following to update Grafana plugin SDK for Go dependency to the latest minor version:

```sh
go get -u github.com/grafana/grafana-plugin-sdk-go
go mod tidy
```

[Build backend plugin binaries](https://grafana.com/tutorials/build-a-data-source-backend-plugin/) for Linux, Windows and Darwin to dist directory:

```sh
mage -v
```
