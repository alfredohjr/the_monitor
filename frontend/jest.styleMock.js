// Stub para imports de CSS (`import "./globals.css"`).
//
// O jest não sabe carregar CSS e falharia no import do layout raiz. Estilo não
// é observável em jsdom de qualquer forma, então um objeto vazio é fiel: o que
// os testes verificam do layout são os exports de metadata, não a folha.
module.exports = {};
