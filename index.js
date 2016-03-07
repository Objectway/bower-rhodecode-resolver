var tmp = require('tmp'),
    request = require('request'),
    fs = require('fs'),
    Q = require('q'),
    RegistryClient = require('bower-registry-client'),
    AdmZip = require('adm-zip'),
    spawnCommand = require('spawn-command');


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
                var tags = lsRemoteOutput.replace(/^.+tags\/([^\s\^]+\n).*$/gm, "$1").trim().split("\n").filter(function (tag) {
                    return !!tag;
                }).map(function (tag) {
                    return {target: tag, version: tag.replace(/[^0-9\.]/gm, '')}
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
                zipFile = tmpDir + '/' + endpoint.name + '.zip';

            bower.logger.debug('rhodecode: repo url', url);

            request.get(url)
                .pipe(fs.createWriteStream(zipFile))
                .on('close', function () {

                    try {
                        var zip = new AdmZip(zipFile);

                        zip.getEntries().forEach(function (zipEntry) {
                            zip.extractEntryTo(zipEntry.entryName, tmpDir, false, true);
                        });

                        fs.unlink(zipFile, function () {

                            deferred.resolve({
                                tempPath: tmpDir,
                                removeIgnores: true
                            });

                        });
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