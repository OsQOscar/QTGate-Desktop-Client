/*!
 * Copyright 2017 QTGate systems Inc. All Rights Reserved.
 *
 * QTGate systems Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as Compress from './compress'
import * as Dns from 'dns'
import * as Net from 'net'
import * as res from './res'
import * as Stream from 'stream'
import * as Crypto from 'crypto'

const Day = 1000 * 60 * 60 * 24

const otherRequestForNet = ( path: string, host: string, port: number, UserAgent: string ) => {
	if ( path.length < 1024 + Math.round( Math.random () * 4000 )) 
		return `GET /${ path } HTTP/1.1\r\n` +
				`Host: ${ host }${ port !== 80 ? ':'+ port : '' }\r\n` +
				`Accept: */*\r\n` +
				`Accept-Language: en-ca\r\n` +
				`Connection: keep-alive\r\n` +
				`Accept-Encoding: gzip, deflate\r\n` +
				`User-Agent: ${ UserAgent ? UserAgent : 'Mozilla/5.0' }\r\n\r\n`
	return 	`POST /${ Crypto.randomBytes ( 10 + Math.round ( Math.random () * 1500 )).toString ( 'base64')} HTTP/1.1\r\n` +
			`Host: ${ host }${ port !== 80 ? ':'+ port : '' }\r\n` +
			`Content-Length: ${ path.length }\r\n\r\n` +
			path + '\r\n\r\n'
}

class hostLookupResponse extends Stream.Writable {
	constructor ( private CallBack: ( err?: Error, dns?: domainData ) => void ) { super ()}
	public _write ( chunk: Buffer, enc, next ) {
		//console.log ( `hostLookupResponse _write come [${ chunk.toString()}]`)
		const ns = chunk.toString ( 'utf8' )
		try {
			const _ret = JSON.parse ( ns )
			const ret: domainData = {
				expire: new Date().getTime () + Day,
				dns: _ret
			}
			this.CallBack ( null, ret )
			next ()
			return this.end ()
		} catch ( e ) {
			return next ( e )
		}
	}
}

export default class gateWay {
	
	private userAgent = null
	private currentGatewayPoint = 0
	private currentgateway: multipleGateway
	
	private request ( str: string, gateway: multipleGateway ) {
		return Buffer.from ( otherRequestForNet ( str, gateway.gateWayIpAddress, gateway.gateWayPort, this.userAgent ), 'utf8' )
	}

	private getCurrentGateway () {
		if ( ++ this.currentGatewayPoint > this.multipleGateway.length - 1 ) {
			this.currentGatewayPoint = 0
		}
		return this.multipleGateway [ this.currentGatewayPoint ]
	}

	constructor ( private multipleGateway: multipleGateway[]) {
	}

	public hostLookup ( hostName: string, userAgent: string, CallBack: ( err?: Error, hostIp?: domainData ) => void ) {


		const _data = new Buffer ( JSON.stringify ({ hostName: hostName }), 'utf8' )
		const gateway = this.getCurrentGateway ()
		const encrypt = new Compress.encryptStream ( gateway.password, 3000, ( str: string ) => {
			return this.request ( str, gateway )
		})
		
		const finish = new hostLookupResponse ( CallBack )
		const httpBlock = new Compress.getDecryptClientStreamFromHttp ()
		const decrypt = new Compress.decryptStream ( gateway.password )
		

		const _socket = Net.createConnection ({ port: gateway.gateWayPort, host: gateway.gateWayIpAddress }, () => {
			encrypt.write ( _data )
		})

		_socket.once ( 'end', () => {
			//console.log ( `_socket.once end!` )
		})

		httpBlock.once ( 'error', err => {
			console.log (`httpBlock.on error`, err )
			_socket.end ( res._HTTP_502 )
			return CallBack ( err )
		})

		decrypt.once ( 'err', err=> {

		} )
		encrypt.pipe ( _socket ).pipe ( httpBlock ).pipe ( decrypt ).pipe ( finish )

	}

	public requestGetWay ( id: string, uuuu: VE_IPptpStream, userAgent: string, socket: Net.Socket ) {
		this.userAgent = userAgent
		const gateway = this.getCurrentGateway ()
		const decrypt = new Compress.decryptStream ( gateway.password )
		const encrypt = new Compress.encryptStream ( gateway.password, 3000, ( str: string ) => {
			return this.request ( str, gateway )
		})
		const httpBlock = new Compress.getDecryptClientStreamFromHttp ()
		httpBlock.once ( 'error', err => {
			socket.end ( res._HTTP_404 )
		})
		const _socket = Net.createConnection ({ port: gateway.gateWayPort||80, host: gateway.gateWayIpAddress }, () => {
			
			encrypt.write ( Buffer.from ( JSON.stringify ( uuuu ), 'utf8' ))
		})
		encrypt.pipe ( _socket ).pipe ( httpBlock ).pipe ( decrypt ).pipe ( socket ).pipe ( encrypt )
		console.log (`new requestGetWay use gateway[${ gateway.gateWayIpAddress }]`)
	}
}