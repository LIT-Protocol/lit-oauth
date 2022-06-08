export const chainReference = {
  solRpc: 'solana',
  evmBasic: 'ethereum'
}

export const updateV1ConditionTypes = (acc) => {
  const unifiedAccessControlConditions = [];
  for (let i = 0; i < acc.length; i++) {
    if (Array.isArray(acc[i])) {
      const updatedConditions = updateV1ConditionTypes(acc[i]);
      unifiedAccessControlConditions.push(updatedConditions);
    } else if (!!acc[i] && !!acc[i]['operator']) {
      unifiedAccessControlConditions.push(acc[i]);
    } else {
      const accHolder = acc[i];
      if (!accHolder['conditionType']) {
        accHolder['conditionType'] = 'evmBasic';
      }
      unifiedAccessControlConditions.push(accHolder);
    }
  }
  return unifiedAccessControlConditions;
}
