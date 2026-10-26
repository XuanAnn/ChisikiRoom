const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests',testMatch:'**/*.spec.cjs',timeout:90000,expect:{timeout:15000},workers:1,retries:0,reporter:'list',outputDir:'../.runtime/playwright'});
