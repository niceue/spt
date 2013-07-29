## spt
Sea.js��Stylus����Ŀ������ߣ�ѹ�����ϲ�����  
ֻ��Ҫ�����¡�package.json���ļ����Ϳ���  
ѹ�����ߺϲ���Ŀ�е�Sea.jsģ��  
ѹ�����ߺϲ���Ŀ�е�Stylus��ʽ


## ʹ�÷���

1. ׼����  
    ����Ŀ���½�һ����Ϊ��build�����ļ��У���spt���ļ��Ž�ȥ
    ���С�npminstall.bat������װ����
    
2. ���á�package.json�����μ����������˵��

3. ���С�build.bat����ִ�д��


## ����˵��
��package.json����ʹ���������ڵ㣨webroot �� build��    
webroot ������վ�ĸ�Ŀ¼��Ĭ���ǡ�../������  
build ���������򣬶���ÿһ����򣺼�ΪĿ���ļ���ֵΪԴ�ļ���  

���Դ�ļ�Ϊĳ��Ŀ¼�����е�js�ļ�����ô����ʹ��*.js������*.styl��  
��һ��Դ�ļ����ó�һ�����飬Ŀ���ļ����ó�һ���������ļ�������Ϊ��ѹ�������ļ����Һϲ���Ŀ���ļ�

���ӣ�  
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
