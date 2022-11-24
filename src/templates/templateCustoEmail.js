const templateCustoEmail = (custo) => {
    return `
        <h1>Olá, seu custo de frete é de R$ ${custo}</h1>
    `;
}

module.exports = templateCustoEmail