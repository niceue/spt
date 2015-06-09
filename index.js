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

var BUF_LENGTH = 64 * 1024;
var _buff = new Buffer(BUF_LENGTH);

function copyFileSync(srcFile, destFile, clobber) {
    if (fs.existsSync(destFile) && !clobber) {
        throw Error('EEXIST')
    }

    var fdr = fs.openSync(srcFile, 'r');
    var stat = fs.fstatSync(fdr);
    var fdw = fs.openSync(destFile, 'w', stat.mode);
    var bytesRead = 1;
    var pos = 0;

    while (bytesRead > 0) {
        bytesRead = fs.readSync(fdr, _buff, 0, BUF_LENGTH, pos);
        fs.writeSync(fdw, _buff, 0, bytesRead);
        pos += bytesRead;
    }

    fs.closeSync(fdr);
    fs.closeSync(fdw);
}

console.log("minifying...\n");
task(cfg.build);
console.log("completed!\n");


function task(obj) {
    var outdir, outname, val, ids = {}, stats,
        _toString = Object.prototype.toString;

    for (var k in obj) {
        val = obj[k];
        //if (!checkExt(k)) continue;

        if (k.substr(-1) === '/') {
            outdir = path.join(ROOT, k);
        } else {
            outdir = path.join(ROOT, path.dirname(k));
            outname = path.basename(k);
        }

        stats = statSync(outdir);
        if (!stats) fs.mkdirSync(outdir);

        console.log('.');
        if (typeof val === 'string') {
            fetch(val, outdir, outname);
        }
        else if ( _toString.call(val) === '[object Array]' ) {
            console.log('start concat ...');
            console.log(k);

            k = ROOT + k;
            fs.writeFileSync(k, '');
            ids[k] = [];

            val.forEach(function(p){
                fetch(p, outdir, outname, true, ids[k]);
            });

            ids[k].length && fs.appendFileSync(k, arr2require(ids[k]));
            console.log('ok: ' + k);
        }
    }
}

function fetch(srcpath, outdir, outname, concat, ids) {
    var arr = srcpath.split('#'),
        src = path.resolve(ROOT, arr[0]),
        cmd = arr[1],
        stats;

    if (src.indexOf('*.') !== -1) {
        src = path.dirname(src);
    }

    stats = statSync(src);
    if (!stats) return;

    if (stats.isFile()) {
        build({
            path: src,
            outdir: outdir,
            name: outname,
            concat: concat,
            cmd: cmd
        }, ids);
    }
    else if (stats.isDirectory()) {
        fs.readdirSync( src ).forEach(function(f) {
            var p = path.join(src, f);
            if (path.basename(f).indexOf('.bak') !== -1 || path.basename(f).indexOf('- \u526f\u672c') !== -1) {
                console.log('skipped: ' + p);
            }
            else {
                build({
                    path: p,
                    outdir: outdir,
                    name: outname,
                    concat: concat,
                    cmd: cmd
                }, ids);
            }
        });
    }
}

function statSync(path) {
    try {
        return fs.statSync(path);
    } catch (err) {
        return err && err.code === "ENOENT" ? false : true;
    }
}

function arr2require(arr) {
    var code = '';
    arr.forEach(function(id){
        code += 'require("'+ id +'");';
    });
    return 'define(function(require){' + code + '});';
}

function checkExt(p) {
    var ext = path.extname(p).replace('.', '');
    return !EXT || (EXT === 'styl' && ext === 'css') || EXT === ext;
}

function build(opt, ids) {
    var ext = path.extname(opt.path).replace('.', '');
    
    if (opt.cmd) {
        if (opt.cmd === '!') {
            opt.noCompress = true;
        }
    }
    if (!opt.name) {
        opt.name = path.basename(opt.path);
    }

    switch (ext) {
        case "js":
            buildJS(opt, ids); break;
        case "styl":
            buildStyl(opt); break;
        case "css":
            buildCSS(opt); break;
        default:
            buildOther(opt);
    }
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

function buildOther(opt) {
    copyFileSync( opt.path, path.join(opt.outdir, opt.outname) );
}