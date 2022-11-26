require('dotenv').config()
const { FactorTable, In_memory_Register, Operadores } = require('./database')

const express = require('express');
const nodemailer = require('nodemailer');
const templete = require('./templates/templeteEmail');
const templateCustoEmail = require('./templates/templateCustoEmail');
const ensureAuthenticated = require('./middleware/middleware');
const jwt = require('jsonwebtoken');
const logger = require('./logger');


const cust_pav = 0.63;
const cust_notpav = 0.72;

const app = express();
app.use(express.json());

const transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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
    logger.info("Factor updated.");
    return res.json({ FactorTable, message: 'Factor updated' });
});

//Consultar os fatores de multiplicação exemplificado na tabela 1 (get)
app.get('/factor/', ensureAuthenticated, (req, res) => {
    const { search } = req.query;

    if (search) {
        const factor = FactorTable.filter((factor) => factor.veiculo.includes(search) || factor.id == Number(search));
        logger.info(`factor findById ${search}`);
        return res.json(factor);
    }

    logger.info("factor list");
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
        logger.info("email sent");
    }

    logger.info("new register successfully created");
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

    logger.info("register successfully updated");
    return res.json({ register: In_memory_Register[registerIndex], message: 'Register updated' });
});

//Deletar um registro do exemplo da tabela 2 (delete);
app.delete('/register/:id', ensureAuthenticated, (req, res) => {

    const { id } = req.params;

    const registerIndex = In_memory_Register.findIndex((register) => register.id == id);

    if (registerIndex < 0) {
        logger.warn("register not found");
        return res.json({ message: 'Register not found' });
    }

    const element_deleted = In_memory_Register.splice(registerIndex, 1);

    if (!element_deleted.length) {
        logger.warn("register not deleted");
        return res.json({ message: 'Register not deleted' });
    }

    logger.info("register successfully deleted");
    return res.json({ message: 'Register deleted' });
});

//Consultar todos os registros do exemplo da tabela 2(get);
app.get('/register', ensureAuthenticated, (req, res) => {
    const { search } = req.query;

    if (search) {
        const register = In_memory_Register.filter((register) => register.veiculo.includes(search) || register.id == Number(search));
        return res.json(register);
    }

    logger.info("register successfully retrieved");
    return res.json({ In_memory_Register });

});

//Usuário recém cadastrado deve receber um e-mail de notificação de cadastro; 
app.post('/auth', async (req, res) => {

    const { email, senha } = req.body;

    if (!email || !senha) {
        logger.warn("error sending email to a new operator.");
        return res.status(400).json({ message: 'Email or password not provided' });
    }

    const index = Operadores.findIndex((operador) => operador.email == email);

    if (index > 0) {
        logger.warn("email field must be fulfilled.");
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
        logger.info("email operator sent successfully");
    } catch (err) {
        logger.warn("error sending email to  a new operator.");
        console.log(err);
    }

    logger.info("new Operator successfully created");
    return res.json({ message: 'Operador cadastrado com sucesso' });
});

//login de usuário
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    const index = Operadores.findIndex((operador) => operador.email == email && operador.senha == senha);

    if (index < 0) {
        logger.warn("Invalid logins attempts");
        return res.json({ message: 'Email ou senha inválidos' });
    }

    const token = jwt.sign({ id: Operadores[index].id }, process.env.TOKEN_SECRET, { expiresIn: '2h' });
    logger.info("a Operator just logged in");
    return res.json({ token });
});

app.listen(3000, () => console.log('Server is running on port 3000'));

const { ftpServer } = require('./ftpServer');
new ftpServer(logger).start();
