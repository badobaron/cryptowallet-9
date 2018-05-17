import { Injectable } from '@angular/core';
import bitcoin from 'bitcoinjs-lib'
import bip39 from 'bip39';
import sb from 'satoshi-bitcoin';
import axios from 'axios';
import { Storage } from '@ionic/storage';

@Injectable()
export class OnixjsProvider {
  mnemonic: any;
  root: any;
  seed: any;
  addrpoint: any;
  child: any;
  balance: 0;
  objAddr = [];
  objKeyPair = []; 

  constructor(private storage: Storage) {
    let strseed = "decline toe notable quote orphan captain pitch violin window unaware kick lion";
    if (typeof strseed == 'undefined') {
      strseed = bip39.generateMnemonic();//generar una nueva semilla (crear nueva cuenta)
    }

    this.mnemonic = strseed;
    this.seed = bip39.mnemonicToSeed(this.mnemonic);
    this.root = bitcoin.HDNode.fromSeedBuffer(this.seed, bitcoin.networks.testnet);
  }

  getInternalAddr(index) {
    return ("m/44'/1'/0'/1/"+index);
  }

  getExternalAddr(index) {
    return ("m/44'/1'/0'/0/"+index);
  }

  setpath(path) {
    this.child = this.root.derivePath(path);
    this.storage.set('pv', this.child);
  }

  getKeyAddr(path) {
    this.setpath(path);
    this.addrpoint = this.child.getAddress();
    this.objKeyPairGenerator();//llamar a esta funcion para almacenar estos valores antes que fn getKeyAddr() sea invocada nuevamente
    return this.addrpoint;
  }

  //almacenar llaves pvt para su respectiva llave pbl
  objKeyPairGenerator() {
    this.objKeyPair.push({ addr: this.addrpoint, pvtKey: this.child.keyPair })
    this.storage.set('pvkey', this.objKeyPair);
  }

  AdrressInputsObject(addr) {
    this.objAddr.push({ txid: addr.txid, txvout: addr.vout, pvtKey: this.child.keyPair});

    this.storage.set('inputs', this.objAddr);
    this.storage.get('inputs').then((resp) => {
      console.log(resp);
    });
    
  }

  sendTransaction(gasto, walletpago, balance) {
    return new Promise((resolve, reject) => {
      try{
        
        var tx = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        
        //se agregan los inpts necesarios para las biteras de pagos y para las billeteras de cambio;
          console.log(1)
          for (const input of this.objAddr) { //llamo a la propieda objAddr que tiene las wallets con fondos para enviar
            tx.addInput(input.txid, input.txvout);
          }
        console.log(2)
          
          //formula de calculo
          var fee = 0.0001;
          if (gasto > balance) {
            return "No existen fondos suficientes"
          }
          gasto = sb.toSatoshi(gasto);

        let amount = gasto + sb.toSatoshi(fee);
         
        let restante = parseInt(sb.toSatoshi(balance)) - amount;
          
        console.log(restante, amount, sb.toSatoshi(balance));

        if (restante < 0) {
          return "No existen fondos suficientes"
        }
        console.log(4);
          //se generan los outputs necesarios para los transacciones (enviar billetera de cambio, y pago a otra persona)
          //si existe balance luego del gasto y de fee lo envio a una wallet de cambio
          console.log(restante);
          
          tx.addOutput(walletpago, gasto);
          
          if (restante > 0) {
            tx.addOutput(this.generateChangeWallet(), restante);//envio a una addr de cambio addr interna 
          } 

          for (let index = 0; index < this.objAddr.length; index++) {//firmar las transacciones con la llave privada
            console.log(balance, gasto);
            tx.sign(index,this.objAddr[index].pvtKey);
          }
          console.log(tx.build().toHex());
          resolve(tx.build().toHex());
    
      }catch(error){
        reject(error);  
      } 
    });  
  }

  generateChangeWallet() {//generar una wallet de cambio
    return this.getKeyAddr(this.getExternalAddr(3));
  }

  getBalancesAddr(addr){
    let url = 'https://test-insight.bitpay.com/api/addr/' + addr + '/utxo';
    return axios.get(url);
  }

  sendInApi(hash){
    let url ='https://test-insight.bitpay.com/api/tx/send';

    return axios.post(url, {rawtx: hash});
  }

}