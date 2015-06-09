#!/usr/local/bin/node
/* Javascript and stylus build tools
 * @author: Jony Zhang <zj86@live.cn>
 * @homepage: https://github.com/niceue/spt
 * @resources:
    https://github.com/mishoo/UglifyJS2/
    http://learnboost.github.io/stylus/
    http://github.com/jbleuzen/node-cssmin
 */

var fs = require('fs'),
    path = require('path'),
    U2 = require("uglify-js"),
    stylus = require('stylus'),
    cssmin = require('cssmin'),
    WORKING_DIR = path.dirname(process.argv[1]),
    EXT = process.argv[2];

process.chdir(WORKING_DIR);
    
var cfg = JSON.parse(fs.readFileSync('package.json')),
    ROOT = cfg.base,
    REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g,
    SLASH_RE = /\\\\/g;

console.log("minifying...\n");
task(cfg.build);
console.log("completed!\n");


function task(obj){
    var outdir, val, ids = {},
        _toString = Object.prototype.toString;
    for (var k in obj) {
        outdir = ROOT + path.dirname(k);
        val = obj[k];
        if (!checkExt(k)) continue;
        if (!fs.existsSync(outdir)) fs.mkdirSync(outdir);

        console.log('.');
        if (typeof val === 'string') {
            val = ROOT + val;
            if (val.indexOf('*.') !== -1) {
                fetch(path.dirname(val), outdir);
            } else {
                build(val, outdir, path.basename(k));
            }
        } else if ( _toString.call(val) === '[object Array]' ) {
            k = ROOT + k;

            var index = k.indexOf("#"),
                forceCMD = false;
            if (index !== -1) {
                // 合并后，转换为CMD模块
                if (k.substring(index+1) === 'cmd') {
                    forceCMD = true;
                }
                k = k.substring(0, index);
            }
            fs.writeFileSync(k, '');
            ids[k] = [];
            
            console.log('start concat ...');
            console.log(k);
            
            if (forceCMD) {
                fs.appendFileSync(k, 'define([],function(){\n');
            }

            var name = path.basename(k);
            val.forEach(function(p){
                
                p = ROOT + p;
                if (p.indexOf('*.') !== -1) {
                    fetch(path.dirname(p), outdir, name, true, ids[k])
                } else {
                    build(p, outdir, name, true, ids[k]);
                }
            });
            if (forceCMD) {
                fs.appendFileSync(k, '});');
            }
            ids[k].length && fs.appendFileSync(k, arr2require(ids[k]));
            console.log('ok: ' + k);
        }
    }
}

function arr2require(arr){
    var code = '';
    arr.forEach(function(id){
        code += 'require("'+ id +'");';
    });
    return 'define(function(require){' + code + '});';
}

function checkExt(p){
    var ext = path.extname(p).replace('.', '');
    return !EXT || (EXT === 'styl' && ext === 'css') || EXT === ext;
}

function build(p, outdir, name, concat, ids){
    var ext,
        noCompress = false,
        forceCMD = false,
        index = p.lastIndexOf("#"),
        opt = {
            path: p.split("#")[0],
            outdir: outdir,
            name: name,
            concat: concat
        };
    
    if (index !== -1) {
        if (p.charAt(index+1) === '!') {
            opt.noCompress = true;
        } else {
            if (p.substring(index+1) === 'cmd') {
                opt.forceCMD = true;
            }
        }
    }
    ext = path.extname(opt.path).replace('.', '');

    switch (ext) {
        case "js":
            buildJS(opt, ids); break;
        case "styl":
            buildStyl(opt); break;
        case "css":
            buildCSS(opt); break;
    }
}

function fetch(src, outdir, name, concat, ids){
    fs.readdirSync(src).forEach(function(f){
        var p = path.join(src, f);
        if (path.basename(f).indexOf('.bak') !== -1 || path.basename(f).indexOf('- \u526f\u672c') !== -1) {
            console.log('skipped: ' + p);
        } else {
            build(p, outdir, name, concat, ids);
        }
    });
}

function parseDependencies(code) {
    var ret = [];
    code.replace(SLASH_RE, "")
        .replace(REQUIRE_RE, function(m, m1, m2) {
            if (m2) {
                ret.push('"' + m2 + '"');
            }
        });
    return '[' + ( ret.length ? ret.join(',') : '' ) + '],';
}

function buildJS(opt, ids) {
    var content = fs.readFileSync(opt.path).toString(),
        ast = U2.parse(content),
        compressor,
        code = '',
        id,
        isConcat = !!opt.concat,
        name = opt.name || path.basename(opt.path),
        outfile = path.join(opt.outdir, name).replace('.debug.', '.');
        
    if (opt.noCompress) {
        code = content;
    } else {
        compressor = U2.Compressor({
            sequences: false,
            warnings: false
        });

        ast.figure_out_scope();
        ast = ast.transform(compressor);

        ast.figure_out_scope();
        ast.compute_char_frequency();
        ast.mangle_names({
            // except: '$,require,exports'
        });

        code = ast.print_to_string();    

        var index = code.indexOf("define(");
        if (index !== -1 && code.substring(index+7, index+8) !== '"') {
            id = path.relative(ROOT, isConcat ? opt.path.replace('.debug.', '.') : outfile).replace(/\\/g, '/');
            id = id.substring(0, id.length-3);
            ids && ids.push(id);
            code = code.substring(0, index) + 'define("' + id + '",' + parseDependencies(content) + code.substring(index+7);
        }
    }
    code += '\n';

    fs[isConcat ? 'appendFileSync' : 'writeFileSync'](outfile, code);
    console.log( isConcat ? '    '+ opt.path : 'ok: '+outfile );
}

function buildStyl(opt) {
    var isConcat = !!opt.concat,
        name = opt.name || (path.basename(opt.path, '.styl') + '.css'),
        content = fs.readFileSync(opt.path).toString(),
        outfile = path.join(opt.outdir, name);

        stylus( content )
            .set('compress', true)
            .set('filename', opt.path)
            .render(function(err, code){
                if (err) throw err;
                code += '\n';
                fs[isConcat ? 'appendFileSync' : 'writeFileSync'](outfile, code);
                console.log( isConcat ? '    '+ opt.path : 'ok: '+outfile );
            });
}

function buildCSS(opt) {
    var isConcat = !!opt.concat,
        name = opt.name || path.basename(opt.path),
        content = fs.readFileSync(opt.path).toString(),
        outfile = path.join(opt.outdir, name),
        code;

    if (opt.noCompress) {
        code = content;
    } else {
        code = cssmin(content).replace(/url\(([^\)]*)/gmi, function(m, m1){
            m1 = m1.replace(/'|"|\s/g, '');
            m1 = path.relative(opt.outdir, path.join( path.dirname(opt.path) , m1) ).replace(/\\/g, '/');
            return "url("+ m1;
        });
    }
    
    code += '\n';
    fs[isConcat ? 'appendFileSync' : 'writeFileSync'](outfile, code);
    console.log( isConcat ? '    '+ opt.path : 'ok: '+outfile );
}
