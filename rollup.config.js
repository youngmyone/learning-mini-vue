
// 根据环境变量中的target属性，获取对应模块中的package.json

// import path from 'path';
// import json from '@rollup/plugin-json';
// import resolvePlugin from '@rollup/plugin-node-resolve';
// import ts from 'rollup-plugin-typescript2';

const path = require('path');
const json = require('@rollup/plugin-json');
const resolvePlugin = require('@rollup/plugin-node-resolve');
const ts = require('rollup-plugin-typescript2');


const packagesDir = path.resolve(__dirname, 'packages');

const packageDir = path.resolve(packagesDir, process.env.TARGET);
// 永远针对的是某个模块
const resolve = (p) => path.resolve(packageDir, p);

const pkg = require(resolve('package.json'));

const name = path.basename(packageDir);

// 对打包的类型 先做一个映射表，根据你提供的formats来格式化需要打包的内容
const outputConfig = { // 自定义的
    'esm-bundler': {
        file: resolve(`dist/${name}.esm-bundler.js`),
        format: 'es'
    },
    'cjs': {
        file: resolve(`dist/${name}.cjs.js`),
        format: 'cjs'
    },
    'global': {
        file: resolve(`dist/${name}.global.js`),
        format: 'iife'
    }
}

const options = pkg.buildOptions; // 自己在package.json中定义的选项

function createConfig(format, output) {
    output.name = options.name;
    output.sourcemap = true;
    
    // 生成rollup配置
    return {
        input: resolve(`src/index.ts`),
        output,
        plugins: [
            json(),
            ts({
                tsconfig: path.resolve(__dirname, 'tsconfig.json')
            }),
            resolvePlugin(), // 解析第三方模块
        ]
    }
}

// rollup最终需要导出配置
// export default options.format.map(format => createConfig(format, outputConfig[format]));
module.exports = options.formats.map(format => createConfig(format, outputConfig[format]));