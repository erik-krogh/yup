import reach, { getIn } from '../src/util/reach';

import {
  addMethod,
  object,
  array,
  string,
  lazy,
  number,
  boolean,
  date,
  ValidationError,
  ObjectSchema,
  ArraySchema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  DateSchema,
} from '../src';

describe('Yup', function () {
  it('cast should not assert on undefined', () => {
    (() => string().cast(undefined)).should.not.throw();
  });

  it('cast should assert on undefined cast results', () => {
    (() =>
      string()
        .transform(() => undefined)
        .cast('foo')).should.throw();
  });

  it('cast should respect assert option', () => {
    (() => string().cast(null)).should.throw();

    (() => string().cast(null, { assert: false })).should.not.throw();
  });

  it('should getIn correctly', async () => {
    let num = number();
    let shape = object({ 'num-1': num });
    let inst = object({
      num: number().max(4),

      nested: object({
        arr: array().of(shape),
      }),
    });

    const value = { nested: { arr: [{}, { 'num-1': 2 }] } };
    let { schema, parent, parentPath } = getIn(
      inst,
      'nested.arr[1].num-1',
      value,
    );

    expect(schema).to.equal(num);
    expect(parentPath).to.equal('num-1');
    expect(parent).to.equal(value.nested.arr[1]);
  });

  it('should getIn array correctly', async () => {
    let num = number();
    let shape = object({ 'num-1': num });
    let inst = object({
      num: number().max(4),

      nested: object({
        arr: array().of(shape),
      }),
    });

    const value = {
      nested: {
        arr: [{}, { 'num-1': 2 }],
      },
    };

    const { schema, parent, parentPath } = getIn(inst, 'nested.arr[1]', value);

    expect(schema).to.equal(shape);
    expect(parentPath).to.equal('1');
    expect(parent).to.equal(value.nested.arr);
  });

  it('should REACH correctly', async () => {
    let num = number();
    let shape = object({ num });

    let inst = object({
      num: number().max(4),

      nested: object({
        arr: array().of(shape),
      }),
    });

    reach(inst, '').should.equal(inst);

    reach(inst, 'nested.arr[0].num').should.equal(num);
    reach(inst, 'nested.arr[].num').should.equal(num);
    reach(inst, 'nested.arr[1].num').should.equal(num);
    reach(inst, 'nested.arr[1]').should.equal(shape);

    reach(inst, 'nested["arr"][1].num').should.not.equal(number());

    let valid = await reach(inst, 'nested.arr[0].num').isValid(5);
    valid.should.equal(true);
  });

  it('should REACH conditionally correctly', async function () {
    var num = number().oneOf([4]),
      inst = object().shape({
        num: number().max(4),
        nested: object().shape({
          arr: array().when('$bar', function (bar) {
            return bar !== 3
              ? array().of(number())
              : array().of(
                  object().shape({
                    foo: number(),
                    num: number().when('foo', (foo) => {
                      if (foo === 5) return num;
                    }),
                  }),
                );
          }),
        }),
      });

    let context = { bar: 3 };
    let value = {
      bar: 3,
      nested: {
        arr: [{ foo: 5 }, { foo: 3 }],
      },
    };

    let options = {};
    options.parent = value.nested.arr[0];
    options.value = options.parent.num;
    reach(inst, 'nested.arr.num', value).resolve(options).should.equal(num);
    reach(inst, 'nested.arr[].num', value).resolve(options).should.equal(num);

    options.context = context;
    reach(inst, 'nested.arr.num', value, context)
      .resolve(options)
      .should.equal(num);
    reach(inst, 'nested.arr[].num', value, context)
      .resolve(options)
      .should.equal(num);
    reach(inst, 'nested.arr[0].num', value, context)
      .resolve(options)
      .should.equal(num);

    // // should fail b/c item[1] is used to resolve the schema
    options.parent = value.nested.arr[1];
    options.value = options.parent.num;
    reach(inst, 'nested["arr"][1].num', value, context)
      .resolve(options)
      .should.not.equal(num);

    let reached = reach(inst, 'nested.arr[].num', value, context);

    await reached.validate(5, { context, parent: { foo: 4 } }).should.be
      .fulfilled;

    await reached
      .validate(5, { context, parent: { foo: 5 } })
      .should.be.rejectedWith(ValidationError, /one of the following/);
  });

  it('should reach through lazy', async () => {
    let types = {
      1: object({ foo: string() }),
      2: object({ foo: number() }),
    };

    let err = await object({
      x: array(lazy((val) => types[val.type])),
    })
      .strict()
      .validate({
        x: [
          { type: 1, foo: '4' },
          { type: 2, foo: '5' },
        ],
      })
      .should.be.rejected();
    err.message.should.match(/must be a `number` type/);
  });

  describe('addMethod', () => {
    test.each([
      ['object', object],
      ['array', array],
      ['string', string],
      ['number', number],
      ['boolean', boolean],
      ['date', date],
    ])('should work with factories: %s', (_msg, factory) => {
      addMethod(factory, 'foo', () => 'here');

      expect(factory().foo()).to.equal('here');
    });

    test.each([
      ['object', ObjectSchema],
      ['array', ArraySchema],
      ['string', StringSchema],
      ['number', NumberSchema],
      ['boolean', BooleanSchema],
      ['date', DateSchema],
    ])('should work with classes: %s', (_msg, ctor) => {
      addMethod(ctor, 'foo', () => 'here');

      expect(new ctor().foo()).to.equal('here');
    });
  });
});
