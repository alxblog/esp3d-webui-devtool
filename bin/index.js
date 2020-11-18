#!/usr/bin/env node
const packageJson = require('./package.json')
const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const clear = require('clear');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { program } = require('commander');

let isProd = false
let firmwareList = []
let formatedFirmwareList = []
let commonWebpackConfigFilePath = ''

/*******************
 *   UTILS SECTION
 *******************/

const resolvePath = (value) => path.resolve(process.cwd(), value)

const getDirectoryList = source =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

const runBuild = (config) => {
    const compiler = webpack(config)
    compiler.run()
}

const runWebDevServer = (config) => {
    console.log('Starting the dev web server...')
    const port = config.devServer.port || 8080
    const server = new WebpackDevServer(webpack(config), config.devServer)
    server.listen(port, 'localhost', function (err) {
        if (err) console.log(err)
        console.log('WebpackDevServer listening at localhost:', port)
    })
}

const generateFirmwareListFromConfig = (arg) => {
    const pathToCheck = arg || resolvePath('./esp3d.config.js')
    if (fs.existsSync(resolvePath(pathToCheck)) && !fs.lstatSync(resolvePath(pathToCheck)).isDirectory()) {
        const { supportedFirmware } = require(resolvePath(pathToCheck))
        return supportedFirmware.map(firmware => firmware.name)
    }
    else throw new Error("esp3d.config.js file not found !")
}

const sanitizeName = (name) =>
    name.trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, '-')


/*******************
*   STEPS SECTION
*******************/

const setToolsOptions = () => {
    firmwareList = generateFirmwareListFromConfig(program.esp3dConfigFile)
    isProd = program.production || false
    if (isProd) firmwareList.push('All')
    formatedFirmwareList = firmwareList.map((target, i) => ({ name: `${i}. ${capitalize(target.replace('-', ' '))}`, value: sanitizeName(target) }))
    commonWebpackConfigFilePath = program.webpackConfigFile || resolvePath('./webpack.config.js')
    /** @todo add EXIT option */
}

const displaySplashScreen = () => {
    console.log(chalk`
=========================
 {white.bgBlack.bold  ESP }{black.bgWhite  3D } WEBUI TOOL 🚀
=========================
`)
}

const displaySelectedEnvironmentMode = () => {
    const modeDisplayed = (isProd) ? chalk.white.bgRed('Production (build)') : chalk.white.bgGreen('Development (dev web server)')
    console.log(`🔧 ${chalk.bold('Mode : ')} ${modeDisplayed}`)
}

const selectTargetAndRun = () => {
    inquirer
        .prompt([
            {
                type: 'list',
                name: 'firmware',
                message: '🎯 Firmware target :',
                choices: formatedFirmwareList,
                filter: (val) => val.toLowerCase().replace(' ', '-')
            }
        ])
        .then((answers) => {
            const webpackConfig = require(commonWebpackConfigFilePath)

            let webpackConfigObj = {}
            if (webpackConfig instanceof Function) { webpackConfigObj = webpackConfig((isProd) ? "prod" : "dev") }
            else webpackConfigObj = webpackConfig
            // Webpack config Promise not supported
            webpackConfigObj.plugins.push(
                new webpack.NormalModuleReplacementPlugin(/(.*)-APP_TARGET(\.*)/, function (resource) {
                    resource.request = resource.request.replace(/-APP_TARGET/, `-${answers.firmware}`)
                }))
            if (isProd) runBuild(webpackConfigObj)
            else runWebDevServer(webpackConfigObj)
        })
}

program.version(packageJson.version)
program
    .option('-P, --production', 'Set Production mode')
    .option('-W, --webpack-config-file <webpackConfigFile>', 'Webpack common config path', resolvePath)
    .option('-E, --esp3d-config-file <esp3dConfigFile>', 'esp3d.config.js file path')

const steps = [
    () => { clear() },
    () => { program.parse(process.argv) },
    setToolsOptions,
    displaySplashScreen,
    displaySelectedEnvironmentMode,
    selectTargetAndRun,
]

for (let i = 0; i < steps.length; i++) steps[i]()