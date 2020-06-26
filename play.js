const safe_regex = require('safe-regex');
const sift = require('sift');

const m = sift({v: {$regex: '^a'}}, {
    operations: {
        $regex: (pattern, ownerQuery, options) => {
            if (!safe_regex(pattern)) throw new Error('"$regex" pattern too complex (dcc)');
            return sift.createEqualsOperation(new RegExp(pattern, ownerQuery.$options), ownerQuery, options);
        },
        $where: (params, ownerQuery, options) => {
            throw new Error('"$where" condition not supported (dcc)');
        },
    },
});

console.log(m({v: 'abc'}));
console.log(m({v: 'tar'}));
