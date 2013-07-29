## spt
Sea.js和Stylus的项目打包工具（压缩，合并）。  
只需要配置下“package.json”文件，就可以  
压缩或者合并项目中的Sea.js模块  
压缩或者合并项目中的Stylus样式


## 使用方法

1. 准备：  
    在项目中新建一个名为“build”的文件夹，把spt的文件放进去
    运行“npminstall.bat”，安装依赖
    
2. 配置“package.json”，参见下面的配置说明

3. 运行“build.bat”，执行打包


## 配置说明
“package.json”中使用了两个节点（webroot 和 build）    
webroot 定义网站的根目录（默认是“../”）。  
build 定义打包规则，对于每一项规则：键为目标文件，值为源文件。  

如果源文件为某个目录中所有的js文件，那么可以使用*.js，或者*.styl。  
将一组源文件配置成一个数组，目标文件配置成一个单独的文件，则认为是压缩这组文件并且合并到目标文件

例子：  
```js
"webroot": "../",
"build": {
    "../scripts/dist/*.js": "../scripts/*.js",
    "../scripts/dist/plugins.js": [
        "plugins/slider/slider.js",  
        "plugins/placeholder/placeholder.js",  
        "plugins/dropdown/dropdown.js", 
        "plugins/validator/validator.js",
        "plugins/validator/zh_CN.js"
    ],
    
    "../styles/dist/*.css": "../styles/stylus/*.styl"
}
```

  
## License

spt is available under the terms of the [MIT License](http://niceue.com/licenses/MIT-LICENSE.txt).
