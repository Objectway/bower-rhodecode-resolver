var tmp = require('tmp'),
    request = require('request'),
    fs = require('fs'),
    path = require('path'),
    Q = require('q'),
    RegistryClient = require('bower-registry-client'),
    AdmZip = require('adm-zip'),
    spawnCommand = require('spawn-command'),
    readChunk = require('read-chunk'), // npm install read-chunk
    FileType = require('file-type');


/**
 * Factory function for resolver
 * It is called only one time by Bower, to instantiate resolver.
 * You can instantiate here any caches or create helper functions.
 */
module.exports = function resolver(bower) {
    var registryClient = new RegistryClient(bower.config, console),
        packageUrl = '';

    bower.logger.debug('bower config', bower.config);
    if (!bower.config.hasOwnProperty('rhodecode') || !bower.config.rhodecode.hasOwnProperty('repo') || !bower.config.rhodecode.hasOwnProperty('token')) {
        bower.logger.error("bower-rhodecode-resolver", "Invalid settings in your .bowerrc file, check you have this properties: \n\"rhodecode\": {\n\t\"repo\": \"www.myrepo.com\",\n\t\"token\": \"asdfghjkl1234567890\"\n}");
        throw new Error("Resolver invalid settings");
    }

    // Resolver factory returns an instance of resolver
    return {
        // Match method tells whether resolver supports given source
        // It can return either boolean or promise of boolean
        match: function (source) {
            packageUrl = source;

            if (source && source.indexOf(bower.config.rhodecode.repo) != -1) {
                return true;
            }

            return Q.nfcall(registryClient.lookup.bind(registryClient), source)
                .then(function (entry) {

                    if (entry && entry.url && entry.url.indexOf(bower.config.rhodecode.repo) != -1) {
                        packageUrl = entry.url;
                        return true
                    }

                    return false;
                });

        },

        locate: function () {
            return packageUrl;
        },

        releases: function (source) {
            var deferred = Q.defer(),
                command = spawnCommand("git ls-remote --tags " + source),
                lsRemoteOutput = '';


            command.stdout.on('data', function (data) {
                lsRemoteOutput += data.toString('utf8');
            });

            command.stdout.on('finish', function () {
                var tags = lsRemoteOutput.match(/(^.+tags\/[^\s\^]+$)/gm).map(function (tag) {
                    var _tag = tag.replace(/^.+tags\/([^\s\^]+)$/gm, '$1');
                    return {target: _tag, version: _tag.replace(/[^0-9\.]/gm, '')}
                });

                deferred.resolve(tags)
            });

            command.stdout.on('error', function (error) {
                deferred.reject(error);
            });

            return deferred.promise;
        },

        // It downloads package and extracts it to temporary directory
        // You can use npm's "tmp" package to tmp directories
        // See the "Resolver API" section for details on this method
        fetch: function (endpoint) {
            var deferred = Q.defer(),
                tmpDir = tmp.dirSync().name,
                target = endpoint.target == '*' ? 'tip' : endpoint.target,
                url = endpoint.source + '/archive/' + target + '.zip?auth_token=' + bower.config.rhodecode.token,
                filePath = tmpDir + '/' + endpoint.name;

            bower.logger.debug('rhodecode: repo url', url);

            request.get(url)
                .pipe(fs.createWriteStream(filePath))
                .on('close', function () {

                    try {
                        var buffer = readChunk.sync(filePath, 0, 262),
                            fileType = FileType(buffer),
                            fileExt = (fileType ? fileType.ext : 'txt'),
                            newFilePath = filePath + '.' + fileExt;

                        fs.renameSync(filePath, newFilePath);

                        if(fileExt === 'zip') {

                            var zip = new AdmZip(newFilePath),
                                extractedDir;

                            zip.getEntries().forEach(function(zipEntry) {
                                zip.extractEntryTo(zipEntry.entryName, tmpDir, true, true);

                                if(typeof extractedDir == 'undefined'){
                                    extractedDir = tmpDir + path.sep + zipEntry.entryName.replace(/(^[^\\\/]+).*/, '$1')
                                }

                            });

                            fs.unlink(newFilePath, function () {
                                deferred.resolve({
                                    tempPath: extractedDir,
                                    removeIgnores: true
                                });

                            });
                        } else {
                            throw new Error("Invalid file, check on this link: " + url);
                        }
                    } catch (err) {
                        deferred.reject(err);
                    }
                })
                .on('error', function (err) {
                    deferred.reject(err);
                });

            return deferred.promise;
        }
    }
};