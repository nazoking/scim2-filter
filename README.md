scim2-filter
============

RFC7643 SCIM(System for Cross-domain Identity Management) 2.0 filter parser.
see [section 3.4.2.2. Filtering](https://tools.ietf.org/html/rfc7644#section-3.4.2.2).

This implements filter syntax parser and json filter function.


usage
-----

You can parse filter query and get ast.

```javascript
import {parse} from 'scim2-filter';

const f = parse(`userType eq "Employee" and emails[type eq "work" and value co "@example.com"]`);
assert.deepEqual(f, {
  op:"and",
  filters:[
    {
      op:"eq",
      attrPath:"userType",
      compValue:"Employee"
    },
    {
      op:"[]",
      attrPath:"emails",
      valFilter:{
        op:"and",
        filters:[
          {
            op:"eq",
            attrPath:"type",
            compValue:"work"
          },
          {
            op:"co",
            attrPath:"value",
            compValue:"@example.com"
          }
        ]
      }
    }
  ]
});
```


and You can use filter in json.

```javascript
import {parse, filter} from 'scim2-filter';

const f = filter(parse(`userName eq "test1@example.com"`));
const users = [
  { userName: "test1@example.com" },
  { userName: "test2@example.com" }
];
const ret = users.filter(f);
assert.deepEqual(ret, [users[0]]);
```



