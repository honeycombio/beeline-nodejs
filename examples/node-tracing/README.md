# node-tracing example

## Overview

This example illustrates a simple comment-wall application using Honeycomb's [Beeline for Node](https://docs.honeycomb.io/getting-data-in/javascript/beeline-nodejs/).

It contains examples of:

- Baseline Beeline usage in an Express app
- Capture of custom metadata on Beeline-generated events
- Definition of custom spans to augment traces
- In-app tracing (across functions within the same service)

## Usage:

Find your Honeycomb API key at https://ui.honeycomb.io/account, then:

### Install and Setup

```bash
npm run setup # installs packages and local beeline as dependency
```

### Running the main application

Run our sample `wall` service with:

```bash
# Will run on port 3000
$ HONEYCOMB_API_KEY=abc123 npm start
```

### Interacting with your application

You may either use the web UI [`http://localhost:3000`](http://localhost:3000) to read and write messages:

| ![index](./images/index.png) | ![new message](./images/message.png) |
| :--------------------------: | :----------------------------------: |
|    View contents of wall     |      Write new message on wall       |

Or `curl` the contents of your wall directly:

```bash
# Fetch the contents of your wall
curl localhost:3000
```

```bash
# Write a new message to your wall
curl localhost:3000 -d "message=i'm #tracing with @honeycombio"
```

## Advanced Usage:
You may find you want to run the example application with a local libhoney version as well as a local beeline version during development. This can be done with the following steps.

Clone [libhoney-js](https://github.com/honeycombio/libhoney-js) as a sibling directory to your beeline-js directory.
### Install and Setup
In this examples/node-tracing directory, setup the example application:
```bash
npm run setup # installs packages and local beeline as dependency
```

In your libhoney-js directory:
```bash
npm install # installs packages required for libhoney
```

In your beeline-nodejs directory:
```bash
npm link ../libhoney-js # creates a symlink of local libhoney in the beeline's node modules
```

In this examples/node-tracing directory, run the application:
```bash
HONEYCOMB_API_KEY=abc123 npm start
```

### Developing
When you make local changes in libhoney, you'll need to run `npm build` in the libhoney directory to compile them and then restart the node-tracing example application. Changes in the local beeline code will be picked up on save when you restart the example application.

### Clean up
To clean up the local libhoney link, in the beeline directory:
```bash
npm unlink --no-save libhoney  
```
After this, you can setup and start the application again (`npm run setup`, `HONEYCOMB_API_KEY=abc123 npm start`) to use the published npm package.