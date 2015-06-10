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

function streamCopyFile(source, target, callback) {
    'use strict';
    var fs = require('fs');
    var stat = fs.statSync(source);
    if (!(callback instanceof Function)) {
        callback = function default_streamCopyFileCallback () {
            return null;
        };
    }
    var finished = false;
    function done(err) {
        if (!finished) {
            callback(err);
        }
        finished = true;
    }
    var readStream = fs.createReadStream(source, {
            flags: 'r',
            encoding: 'binary',
            fd: null,
            mode: stat.mode,
            autoClose: true
        });
    readStream.on('error', function (err) {
        done(err);
    });
    var writeStream = fs.createWriteStream(target, {
            flags: 'w',
            encoding: 'binary',
            mode: stat.mode
        });
    writeStream.on('error', function (err) {
        done(err);
    });
    writeStream.on('close', function () {
        done();
    });
    readStream.pipe(writeStream);
}

function mkpathSync(dirpath, mode) {
    dirpath = path.resolve(dirpath);

    if (typeof mode === 'undefined') {
        mode = 0777 & (~process.umask());
    }

    try {
        if (!fs.statSync(dirpath).isDirectory()) {
            throw new Error(dirpath + ' exists and is not a directory');
        }
    } catch (err) {
        if (err.code === 'ENOENT') {
            mkpathSync(path.dirname(dirpath), mode);
            fs.mkdirSync(dirpath, mode);
        } else {
            throw err;
        }
    }
}

function statSync(path) {
    try {
        return fs.statSync(path);
    } catch (err) {
        return err && err.code === "ENOENT" ? false : true;
    }
}

console.log("building...");
task(cfg.build);
console.log("\ncompleted!\n");


function task(obj) {
    var outdir, outname, val, ids = {}, stats,
        _toString = Object.prototype.toString;

    for (var k in obj) {
        val = obj[k];
        outname = null;
        //if (!checkExt(k)) continue;
        console.log('\n[task] "' + k + '": "' + val + '"');

        if (k.substr(-1) === '/') {
            outdir = path.join(ROOT, k);
        } else {
            outdir = path.join(ROOT, path.dirname(k));
            if (!~k.lastIndexOf('*.')) {
                outname = path.basename(k);
            }
        }

        stats = statSync(outdir);
        if (!stats) {
            mkpathSync(outdir);
            console.log('mkdir: ' + outdir)
        }

        if (typeof val === 'string') {
            fetch(val, outdir, outname);
        }
        else if ( _toString.call(val) === '[object Array]' ) {
            console.log('start concat >>>');
            console.log(k);

            k = ROOT + k;
            fs.writeFileSync(k, '');
            ids[k] = [];

            val.forEach(function(p){
                fetch(p, outdir, outname, true, ids[k]);
            });

            ids[k].length && fs.appendFileSync(k, arr2require(ids[k]));
            console.log( 'ok: ' + k );
            console.log('end concat <<<');
        }
    }
}

function fetch(srcpath, outdir, outname, concat, ids) {
    var arr = srcpath.split('#'),
        src = path.resolve(ROOT, arr[0]),
        cmd = arr[1],
        stats,
        ext;

    if (src.indexOf('*.') !== -1) {
        ext = path.extname(src);
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
            if (ext && ext !== path.extname(f)) {
                return;
            }
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
                    cmd: cmd,
                    ext: path.extname(f)
                }, ids);
            }
        });
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
    opt.ext = opt.ext || path.extname(opt.path);
    
    if (opt.cmd) {
        if (opt.cmd === '!') {
            opt.noCompress = true;
        }
    }
    if (!opt.name) {
        opt.name = path.basename(opt.path);
    }

    switch (opt.ext) {
        case ".js":
            buildJS(opt, ids); break;
        case ".styl":
            buildStyl(opt); break;
        case ".css":
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
    console.log( isConcat ? '    '+ opt.path : ( opt.noCompress ? 'copy: ' : 'min: ') + outfile );
}

function buildStyl(opt) {
    var isConcat = !!opt.concat,
        name = opt.name || (path.basename(opt.path, '.styl') + '.css'),
        content = fs.readFileSync(opt.path).toString(),
        outfile = path.join(opt.outdir, name);

    if (opt.noCompress) {
        fs[isConcat ? 'appendFileSync' : 'writeFileSync'](outfile, content);
        console.log( isConcat ? '    '+ opt.path : 'copy: =>'+outfile );
    } else {
        stylus( content )
            .set('compress', true)
            .set('filename', opt.path)
            .render(function(err, code){
                if (err) throw err;
                code += '\n';
                fs[isConcat ? 'appendFileSync' : 'writeFileSync'](outfile, code);
                console.log( isConcat ? '    '+ opt.path : 'compile: ' + outfile );
            });
    }
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
    console.log( isConcat ? '    '+ opt.path : ( opt.noCompress ? 'copy: ' : 'min: ') + outfile );
}

function buildOther(opt) {
    var stats = statSync(opt.path);
    if (!stats) {
        console.log( 'skipped: path "'+ opt.path + '" is not exist!' );
        return;
    }
    if (stats.isFile()) {
        var outfile = path.join(opt.outdir, opt.outname || path.basename(opt.path));
        streamCopyFile(opt.path,  outfile, function() {
            console.log( 'copy: '+ outfile );
        });
    }
    else if (stats.isDirectory()) {
        var outdir = opt.outdir + opt.path.split(path.sep).pop();
        mkpathSync(outdir);
        console.log( 'mkdir: ' + outdir );
        fetch(opt.path + (opt.cmd ? '#' + opt.cmd : ''), outdir);
    }
}