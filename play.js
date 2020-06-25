// import sift from 'sift';
const sift = require('sift');

const m = sift({v: {$where: '^a'}}, {
    operations: {
        $regex: (params, ownerQuery, options) =>
            sift.createEqualsOperation(b => { throw '$regex uh oh' }, ownerQuery, options),
        $where: (params, ownerQuery, options) => { throw '$where not supported'; },
    },
});

console.log(m({v: 'abc'}));
