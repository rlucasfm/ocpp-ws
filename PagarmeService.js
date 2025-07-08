const PAGARME_API_URL = 'https://api.pagar.me/core/v5';
const PAGARME_API_URL_SDX = 'https://api.pagar.me/sdx/v1';
const PAGARME_API_KEY = 'sk_test_59b2bf5c1f81469ab9a00d5a5dbf5161';

class PagarmeService {
  // CLIENTES
  async criarCliente(payload) {
    return fetch(`${PAGARME_API_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload),
    }).then((res) => res.json());
  }

  async listarClientes(params = '') {
    return fetch(`${PAGARME_API_URL}/customers${params}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  async atualizarCliente(id, payload) {
    return fetch(`${PAGARME_API_URL}/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload),
    }).then(res => res.json());
  }

  // CARTÕES
  async criarCartao(payload) {
    const payload_to_send = {
      number: payload.number,
      holder_name: payload.holder_name,
      exp_month: Number(payload.exp_month),
      exp_year: Number(payload.exp_year),
      cvv: payload.cvv,
      billing_address_id: payload.billing_address_id,
    };

    const response = await fetch(`${PAGARME_API_URL}/customers/${payload.customer_id}/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload_to_send),
    });
    if (response.status !== 200) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.message || 'Erro ao cadastrar cartão na Pagarme.');
    }
    return response.json();
  }

  async obterCartao(id, customer_id) {
    return fetch(`${PAGARME_API_URL}/customers/${customer_id}/cards/${id}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  async listarCartoes(customer_id) {
    return fetch(`${PAGARME_API_URL}/customers/${customer_id}/cards`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  async excluirCartao(id, customer_id) {
    return fetch(`${PAGARME_API_URL}/customers/${customer_id}/cards/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  // PEDIDOS
  async criarPedido(payload) {
    const response = await fetch(`${PAGARME_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.status !== 200) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.message || 'Erro ao criar pedido na Pagarme.');
    }
    return response.json();
  }

  async obterPedido(id) {
    return fetch(`${PAGARME_API_URL}/orders/${id}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  async listarPedidos(params = '') {
    return fetch(`${PAGARME_API_URL}/orders${params}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  // COBRANÇAS
  async capturarCobranca(id, amount = null) {
    const payload = amount ? { amount: (amount * 100).toFixed(0) } : {};
    console.log('payload', payload);
    return fetch(`${PAGARME_API_URL}/charges/${id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload),
    }).then(res => res.json());
  }

  async obterCobranca(id) {
    return fetch(`${PAGARME_API_URL}/charges/${id}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  async cancelarCobranca(id) {
    return fetch(`${PAGARME_API_URL}/charges/${id}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  // ENDEREÇOS
  async criarEndereco(customer_id, payload) {
    return fetch(`${PAGARME_API_URL}/customers/${customer_id}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
      body: JSON.stringify(payload),
    }).then(res => res.json());
  }

  async listarEnderecos(customer_id) {
    return fetch(`${PAGARME_API_URL}/customers/${customer_id}/addresses`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }

  async excluirEndereco(customer_id, address_id) {
    return fetch(`${PAGARME_API_URL}/customers/${customer_id}/addresses/${address_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(PAGARME_API_KEY + ':').toString('base64')}`,
      },
    }).then(res => res.json());
  }
}

module.exports = { PagarmeService }; 