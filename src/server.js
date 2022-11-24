const express = require('express');
const nodemailer = require('nodemailer');
const templete = require('./templates/templeteEmail');
const templateCustoEmail = require('./templates/templateCustoEmail');
const ensureAuthenticated = require('./middleware/middleware');
const jwt = require('jsonwebtoken');

const cust_pav = 0.63;
const cust_notpav = 0.72;

const app = express();
app.use(express.json());

const FactorTable = [
    { "id": 1, "veiculo": "Veiculo Urbano", "fator": 1.0 },
    { "id": 2, "veiculo": "Caminhao 3/4", "fator": 1.05 },
    { "id": 3, "veiculo": "Caminhão toco", "fator": 1.08 },
    { "id": 4, "veiculo": "Caminhão Simple", "fator": 1.13 },
    { "id": 5, "veiculo": "Carreta eixo estendido", "fator": 1.19 },
]

const transport = nodemailer.createTransport({
    host: "smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: "248253e2ed7da9",
        pass: "72696c6300e2de"
    }
});

const In_memory_Register = [];
const Operadores = [];

function calc_price(dist_pav, dist_notpav, id, carga) {

    const factor = FactorTable.find((factor) => factor.id == id).fator;
    const custo_total = ((dist_pav * cust_pav) + (dist_notpav * cust_notpav)) * factor;

    if (carga <= 5) return custo_total;

    const acrescimo = (carga - 5) * 0.03;
    const soma_dist = ((dist_pav) + (dist_notpav)) * acrescimo;
    return custo_total + soma_dist;

}

//Atualizar o fator de multiplicação exemplificado na tabela 1 (post)
app.post('/factor/:id', ensureAuthenticated, (req, res) => {

    const { id } = req.params;
    const { newFactor } = req.body;

    const factorIndex = FactorTable.findIndex((factor) => factor.id == id);

    FactorTable[factorIndex] = { ...FactorTable[factorIndex], fator: newFactor };

    return res.json({ FactorTable, message: 'Factor updated' });
});

//Consultar os fatores de multiplicação exemplificado na tabela 1 (get)
app.get('/factor/', ensureAuthenticated, (req, res) => {
    const { search } = req.query;

    if (search) {
        const factor = FactorTable.filter((factor) => factor.veiculo.includes(search) || factor.id == Number(search));
        return res.json(factor);
    }
    return res.json({ FactorTable });

});

//Criar um registro do exemplo da tabela 2 (obs: o custo total deve ser calculado pelaaplicação) (post)
app.post('/register', ensureAuthenticated, (req, res) => {
    const { dist_pav, dist_notpav, id, carga, email } = req.body;

    const valor_total = calc_price(dist_pav, dist_notpav, id, carga);
    const register = {
        dist_pav,
        dist_notpav,
        veiculo: FactorTable.find((factor) => factor.id == id).veiculo,
        carga,
        email,
        valor_total: valor_total.toFixed(2),
        id: In_memory_Register.length + 1
    }

    In_memory_Register.push(register);

    if (email) {
        const message = {
            from: 'teste@teste.com',
            to: email,
            subject: 'Custo de frete',
            html: templateCustoEmail(valor_total.toFixed(2))
        }

        transport.sendMail(message, (err, info) => {
            if (err) {
                console.log(err);
                return res.status(400).json({ message: 'Error sending email' });
            }
            console.log(info);
            return res.json({ register, message: 'Register created and email sent' });
        });
    }

    return res.json({ register, message: 'Register created' });

});

//Atualizar um registro do exemplo da tabela 2 (obs: o custo total deve ser calculado pela aplicação) (put);
app.post('/register/:id', ensureAuthenticated, (req, res) => {
    const { id } = req.params;
    const { dist_pav, dist_notpav, factorId, carga } = req.body;

    const registerIndex = In_memory_Register.findIndex((register) => register.id == id);
    const valor_total = calc_price(dist_pav, dist_notpav, factorId, carga);

    In_memory_Register[registerIndex] = {
        ...In_memory_Register[registerIndex],
        dist_pav, dist_notpav,
        veiculo: FactorTable.find((fator) => fator.id == factorId).veiculo,
        carga,
        valor_total: valor_total.toFixed(2),
    };

    return res.json({ register: In_memory_Register[registerIndex], message: 'Register updated' });
});

//Deletar um registro do exemplo da tabela 2 (delete);
app.delete('/register/:id', ensureAuthenticated, (req, res) => {
    const { id } = req.params;

    const registerIndex = In_memory_Register.findIndex((register) => register.id == id);

    if (registerIndex < 0) {
        return res.json({ message: 'Register not found' });
    }

    const element_deleted = In_memory_Register.splice(registerIndex, 1);

    if (!element_deleted.length) {
        return res.json({ message: 'Register not deleted' });
    }

    return res.json({ message: 'Register deleted' });
});

//Consultar todos os registros do exemplo da tabela 2(get);

app.get('/register', ensureAuthenticated, (req, res) => {
    const { search } = req.query;

    if (search) {
        const register = In_memory_Register.filter((register) => register.veiculo.includes(search) || register.id == Number(search));
        return res.json(register);
    }
    return res.json({ In_memory_Register });

});

//Usuário recém cadastrado deve receber um e-mail de notificação de cadastro; 
app.post('/auth', async (req, res) => {

    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ message: 'Email or password not provided' });
    }

    const index = Operadores.findIndex((operador) => operador.email == email);

    if (index > 0) {
        return res.json({ message: 'Email inválido para cadastro' });
    }

    Operadores.push({ email, senha, id: Operadores.length + 1 });



    try {
        await transport.sendMail({
            from: 'welcome@test',
            to: email,
            subject: 'Bem vindo',
            html: templete
        })
    } catch (err) {
        console.log(err);
    }

    return res.json({ message: 'Operador cadastrado com sucesso' });
});

//login de usuário
app.post('/login', (req, res) => {
    console.log(Operadores)
    const { email, senha } = req.body;

    const index = Operadores.findIndex((operador) => operador.email == email && operador.senha == senha);

    if (index < 0) {
        return res.json({ message: 'Email ou senha inválidos' });
    }

    const token = jwt.sign({ id: Operadores[index].id }, 'teste', { expiresIn: '2h' });

    return res.json({ email, senha, token });
});


app.listen(3000, () => console.log('Server is running on port 3000'));
