Abra o index.html no navegador para visualizar.

Hospedagem (estático): envie TODOS os arquivos para a raiz do seu host mantendo os nomes.

Produtos/categorias: edite menu.json.
- Para criar a aba "Mais vendidos", você pode:
  a) marcar itens com "bestSeller": true, OU
  b) criar "bestSellers": ["id-do-item", ...] no topo do JSON.

Cores/estilo: styles.css.

Gateway: edite checkout.js (função de pagamento).
- Quando houver retorno positivo, chame createOrderAndRedirect() para salvar o pedido e ir para success.html.
- success.html tem acompanhamento automático:
  • Produção: 25min
  • Saiu para entrega: +10min
  • Depois: cancelado + aviso de estorno automático
