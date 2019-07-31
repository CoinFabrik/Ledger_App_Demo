import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import TransportWebAuthn from "@ledgerhq/hw-transport-webauthn";
import TransportU2F from "@ledgerhq/hw-transport-u2f";
import algosdk_address from 'algosdk/src/encoding/address';
import Queue from 'promise-queue';
import BN from 'bn.js';

//------------------------------------------------------------------------------

const CLA = 0x80;
const INS_GET_PUBLIC_KEY = 0x03;
const INS_SIGN_PAYMENT_V2 = 0x04;
const INS_SIGN_KEYREG_V2 = 0x05;

const STATUS_OK = 0x90;
const STATUS_APP_NOT_LOADED = 0x6E;
const STATUS_DEVICE_LOCKED = 0x0468;
const STATUS_OPERATION_CANCELED = 0x8569;

//------------------------------------------------------------------------------

const isSupported = TransportWebUSB.isSupported || TransportU2F.isSupported || TransportWebAuthn.isSupported;

//------------------------------------------------------------------------------

export default class LedgerUSB {
	constructor() {
		this.transport = null;
		this.commandQueue = new Queue(1, Infinity);
	}

	static isSupported() {
		return isSupported;
	}

	async getAddress() {
		await openLedger(this);
		try {
			const publicKey = await queueCommand(this, INS_GET_PUBLIC_KEY);
			return algosdk_address.encode(publicKey);
		}
		catch (err) {
			this.transport = null;
			throw err;
		}
	}

	async signTransaction(tx) {
		if (!(isObject(tx) && isObject(tx.txn))) {
			throw new Error("Invalid transaction");
		}

		let ins;
		let data = [];

		if (tx.txn.type === 'pay') {
			ins = INS_SIGN_PAYMENT_V2;
		}
		else if (tx.txn.type === 'keyreg') {
			ins = INS_SIGN_KEYREG_V2;
		}
		else {
			throw new Error("Unknown transaction type " + tx.txn.type);
		}
		//sender
		data.push(Buffer.from(tx.txn.snd));
		//fee
		data.push(uint64ToBuffer(tx.txn.fee));
		//first round
		data.push(uint64ToBuffer(tx.txn.fv));
		//last round
		data.push(uint64ToBuffer(tx.txn.lv));
		//genesis id
		data.push(padBuffer(tx.txn.gen, 32));
		//genesis hash
		data.push(Buffer.from(tx.txn.gh));
		//if payment transaction
		if (tx.txn.type === 'pay') {
			//receiver
			data.push(Buffer.from(tx.txn.rcv));
			//amount
			data.push(uint64ToBuffer(tx.txn.amt));
			//close address
			if (typeof tx.txn.close != "undefined" && tx.txn.close) {
				data.push(Buffer.from(tx.txn.close));
			}
			else {
				data.push(Buffer.alloc(32, 0));
			}
		}
		/*
		//if a keyreg transaction
		else if (tx.txn.type === 'keyreg') {
			data.push(padBuffer(txn["votekey"], 32)); //votepk
			data.push(padBuffer(txn["selkey"], 32));  //vrfpk
		}
		*/

		await openLedger(this);
		try {
			const signature = await queueCommand(this, ins, data);
			return signature;
		}
		catch (err) {
			this.transport = null;
			throw err;
		}
	}
}

//------------------------------------------------------------------------------

async function openLedger(_this) {
	if (!_this.transport) {
		if (!isSupported) {
			throw new Error("Unsupported");
		}
		if (TransportWebAuthn.isSupported) {
			_this.transport = await TransportWebAuthn.create(); //this will create the first available device connected
			if (_this.transport) {
				_this.transport.setScrambleKey('algo');
			}
		}
		if ((!_this.transport) && TransportU2F.isSupported) {
			try {
				_this.transport = await TransportU2F.create(); //this will create the first available device connected
				if (_this.transport) {
					_this.transport.setScrambleKey('algo');
				}
			}
			catch (err) {
				_this.transport = null;
			}
		}
		if ((!_this.transport) && TransportWebUSB.isSupported) {
			try {
				_this.transport = await TransportWebUSB.create(); //this will create the first available device connected
			}
			catch (err) {
				_this.transport = null;
			}
		}
		if (!_this.transport) {
			throw new Error("Device not found");
		}
	}
}

function queueCommand(_this, ins, data) {

	let command = [];
	
	command.push(Buffer.from([ CLA, ins, 0, 0 ]));

	if (!data) {
		data = Buffer.alloc(0);
	}
	else if (Array.isArray(data)) {
		data = Buffer.concat(data);
	}
	if (data.byteLength === 0) {
		command.push(Buffer.from([ 0 ]));
	}
	else if (data.byteLength <= 255) {
		command.push(Buffer.from([ data.byteLength ]));
		command.push(data);
	}
	/*
	//NOT SUPPORTED YET
	else if (data.byteLength <= 65535) {
		command.push(Buffer.from([ 0, data.byteLength & 255, data.byteLength / 8 ]));
		command.push(data);
	}
	*/
	else {
		throw new Error("Data too long");
	}
	command = Buffer.concat(command);

	return new Promise((resolve, reject) => {
		let _that = _this;

		_this.commandQueue.add(function () {
			return sendToLedger(_that.transport, command);
		}).then((result) => {
			resolve(result);
		}).catch((err) => {
			reject(err);
		});
	});
}

async function sendToLedger(transport, buffer) {
	const data = await transport.exchange(buffer);
	if ((!data) || data.length < 2) {
		throw new Error("Invalid response [" + data + "]");
	}
	const status = data[data.length - 2] + data[data.length - 1] * 256;
	if (status !== STATUS_OK) {
		if (status === STATUS_APP_NOT_LOADED) {
			throw new Error("The Algorand application is not loaded.");
		}
		if (status === STATUS_OPERATION_CANCELED) {
			throw new Error("The operation was canceled.");
		}
		if (status === STATUS_DEVICE_LOCKED) {
			throw new Error("Device is locked.");
		}
		throw new Error("Invalid response status [0x" + status.toString(16) + "]");
	}
	return data.slice(0, data.length - 2);
}

function padBuffer(str, size) {
	let ret = Buffer.alloc(size, 0);
	if (str) {
		if (str.length > size) {
			throw new Error("String too long (" + str.length + " > " + size + ")");
		}
		ret.write(str, 0);
	}
	return ret;
}

function uint64ToBuffer(value) {
	return (new BN(value)).toArrayLike(Buffer, 'le', 8);
}

function isObject(obj) {
	return (typeof obj === 'object' && (!Array.isArray(obj)));
}
