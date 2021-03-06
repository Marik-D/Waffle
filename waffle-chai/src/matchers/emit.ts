import {Contract} from 'ethers';

export function supportEmit(Assertion: Chai.AssertionStatic) {
  const filterLogsWithTopics = (logs: any[], topic: any, contractAddress: string) =>
    logs.filter((log) => log.topics.includes(topic))
      .filter((log) => log.address && log.address.toLowerCase() === contractAddress.toLowerCase());

  Assertion.addMethod('emit', function (this: any, contract: Contract, eventName: string) {
    const promise = this._obj;
    const derivedPromise = promise.then((tx: any) =>
      contract.provider.getTransactionReceipt(tx.hash)
    ).then((receipt: any) => {
      const eventDescription = contract.interface.events[eventName];

      if (eventDescription === undefined) {
        const isNegated = this.__flags.negate === true;

        this.assert(
          isNegated,
          `Expected event "${eventName}" to be emitted, but it doesn't` +
          ' exist in the contract. Please make sure you\'ve compiled' +
          ' its latest version before running the test.',
          `WARNING: Expected event "${eventName}" NOT to be emitted.` +
          ' The event wasn\'t emitted because it doesn\'t' +
          ' exist in the contract. Please make sure you\'ve compiled' +
          ' its latest version before running the test.',
          eventName,
          ''
        );
      }

      const {topic} = eventDescription;
      this.logs = filterLogsWithTopics(receipt.logs, topic, contract.address);
      this.assert(this.logs.length > 0,
        `Expected event "${eventName}" to be emitted, but it wasn't`,
        `Expected event "${eventName}" NOT to be emitted, but it was`
      );
    });
    this.then = derivedPromise.then.bind(derivedPromise);
    this.catch = derivedPromise.catch.bind(derivedPromise);
    this.promise = derivedPromise;
    this.contract = contract;
    this.eventName = eventName;
    return this;
  });

  const assertArgsArraysEqual = (context: any, expectedArgs: any[], log: any) => {
    const actualArgs = context.contract.interface.parseLog(log).values;
    context.assert(
      actualArgs.length === expectedArgs.length,
      `Expected "${context.eventName}" event to have ${expectedArgs.length} argument(s), ` +
      `but has ${actualArgs.length}`,
      'Do not combine .not. with .withArgs()',
      expectedArgs.length,
      actualArgs.length
    );
    for (let index = 0; index < expectedArgs.length; index++) {
      if (expectedArgs[index].length !== undefined && typeof expectedArgs[index] !== 'string') {
        for (let j = 0; j < expectedArgs[index].length; j++) {
          new Assertion(expectedArgs[index][j]).equal(actualArgs[index][j]);
        }
      } else {
        new Assertion((expectedArgs[index])).equal((actualArgs[index]));
      }
    }
  };

  const tryAssertArgsArraysEqual = (context: any, expectedArgs: any[], logs: any[]) => {
    if (logs.length === 1) return assertArgsArraysEqual(context, expectedArgs, logs[0]);
    for (const index in logs) {
      try {
        assertArgsArraysEqual(context, expectedArgs, logs[index]);
        return;
      } catch {}
    }
    context.assert(false,
      `Specified args not emitted in any of ${context.logs.length} emitted "${context.eventName}" events`,
      'Do not combine .not. with .withArgs()'
    );
  };

  Assertion.addMethod('withArgs', function (this: any, ...expectedArgs: any[]) {
    const derivedPromise = this.promise.then(() => {
      tryAssertArgsArraysEqual(this, expectedArgs, this.logs);
    });
    this.then = derivedPromise.then.bind(derivedPromise);
    this.catch = derivedPromise.catch.bind(derivedPromise);
    return this;
  });
}
