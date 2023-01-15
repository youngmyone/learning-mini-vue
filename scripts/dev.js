// 只针对某个具体模块

const fs = require('fs');
const execa = require('execa');

// 对我们目标进行依次打包，并行打包
async function build(target) {
    await execa('rollup', ['-c', '--environment', `TARGET:${target}`, '-w'], 
        {stdio: 'inherit'}); // 将子进程打包的信息共享给父进程
}

const target = 'reactivity';
build(target);