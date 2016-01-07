#!/usr/local/bin/node
/* Javascript and stylus build tools
 * @author: Jony Zhang <zj86@live.cn>
 * @homepage: https://github.com/niceue/spt
 * @resources:
    https://github.com/mishoo/UglifyJS2/
    http://learnboost.github.io/stylus/
    https://github.com/jakubpawlowicz/clean-css
 */

var fs = require('fs'),
    path = require('path'),
    U2 = require("uglify-js"),
    stylus = require('stylus'),
    CleanCSS = require('clean-css');

var cfg = JSON.parse(fs.readFileSync('package.json')),
    WORKING_DIR = process.cwd(),
    EXT = process.argv[2]
    ROOT = (function(){
        var dir = cfg.base || './';
        if (dir.substr(-1) !== '/') dir += '/';
        return dir;
    })(),
    REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g,
    SLASH_RE = /\\\\/g;

console.log(WORKING_DIR);
console.log('base: ' + ROOT);
console.log("\nbuilding...");
task(cfg.build);
console.log("\ncompleted!\n");

function unique(arr){
    var ret = [];
    var obj = {};
    for(var i = 0, len = arr.length; i < len; i++){
        if (!obj[arr[i]]) {
            ret.push(arr[i]);
            obj[arr[i]] = 1;
        }
    }
    return ret;
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


function task(obj) {
    var outdir, outname, val, ids = {}, stats,
        _toString = Object.prototype.toString,
        rFile = /\.[a-z]{2,4}$/i;

    for (var k in obj) {
        val = obj[k];
        outname = null;
        //if (!checkExt(k)) continue;
        console.log('\n[task] "' + k + '": "' + val + '"');

        if (!rFile.test(k)) {
            if (k.substr(-1) === '/') {
                k = k.substr(0, k.length-1);
            }
            outdir = path.join(ROOT, k);
        }
        else {
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

    updateManifest(WORKING_DIR);
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
            cmd: cmd,
            stats: stats,
            isFile: true
        }, ids);
    }
    else if (stats.isDirectory()) {
        fs.readdirSync( src ).forEach(function(f) {
            var p = path.join(src, f);
            var stats = statSync(p);
            if (!stats) return;
            var isFile = stats.isFile();

            if (ext && isFile && ext !== path.extname(f)) {
                return;
            }

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
                    ext: path.extname(f),
                    stats: stats,
                    isFile: isFile
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
    switch (opt.name) {
        case 'Thumbs.db':
            return;
    }
    if (opt.isFile) {
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
    } else {
        buildOther(opt);
    }
}

function parseDependencies(code) {
    var arr = [];
    code.replace(SLASH_RE, "")
        .replace(REQUIRE_RE, function(m, m1, m2) {
            if (m2) {
                arr.push('"' + m2 + '"');
            }
        });
    arr = unique(arr);
    return '[' + ( arr.length ? arr.join(',') : '' ) + '],';
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
        name = path.basename(opt.path, '.styl') + '.css',
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
        code = new CleanCSS({
            keepSpecialComments: 0
        }).minify(content).styles.replace(/url\(([^\)]*)/gmi, function(m, m1){
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
    if (opt.isFile) {
        var outfile = path.join(opt.outdir, opt.outname || path.basename(opt.path)),
            readStream = fs.createReadStream(opt.path),
            writeStream = fs.createWriteStream(outfile);

        writeStream.on('finish', function(err) {
            if (err) {
                console.log(err);
                return;
            }
            fs.utimesSync(outfile, opt.stats.atime, opt.stats.mtime);
        });
        readStream.pipe( writeStream );
        console.log( 'copy: '+ outfile );
    }
    else {
        var outdir = opt.outdir + path.sep + opt.path.split(path.sep).pop();
        mkpathSync(outdir);
        console.log( '\nmkdir: ' + outdir );
        fetch(opt.path + (opt.cmd ? '#' + opt.cmd : ''), outdir);
    }
}

//change appcache.manifest
function updateManifest(dir) {
    var filename = 'appcache.manifest',
        filepath = path.resolve(dir, filename),
        stat = statSync( filepath ),
        content, timeStr;

    if (!stat || !stat.isFile()) return;

    timeStr = new Date().toISOString().replace('T', ' ');
    content = fs.readFileSync(filepath, 'utf-8').toString().replace(/(#Time:\s*)[^\n]*/gmi, '$1'+timeStr);
    console.log('\nUpdate '+ filename + ' @' + timeStr);

    fs.writeFileSync(filepath, content);
}