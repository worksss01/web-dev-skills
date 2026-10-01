import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan} from '../web-debug/scripts/plan.mjs';
import {scanProtocol} from './protocol-review.mjs';

const validate=(method,params={},policy={allowRawCdp:true})=>validatePlan({actions:[{type:'cdp',method,params}]},policy);
test('Raw mode denies Extensions/PWA and unknown domains without losing ordinary diagnostics',()=>{
  for(const method of ['Extensions.loadUnpacked','PWA.launchFilesInApp','Browser.getVersion','Target.createTarget','FutureDomain.readLocalFile'])assert.throws(()=>validate(method),/domain.*not supported/);
  validate('DOMSnapshot.captureSnapshot',{computedStyles:[]});validate('Runtime.getIsolateId');validate('Debugger.enable');
});
test('File drag rejects nonempty or malformed files even with raw opt-in',()=>{
  for(const files of [['C:\\fixture.txt'],['../fixture'],[''],null,false,'fixture',{}])assert.throws(()=>validate('Input.dispatchDragEvent',{data:{files}}),/Dragging local files/);
});
test('Data-only drag remains available but requires raw opt-in',()=>{
  const params={type:'drop',x:10,y:10,data:{items:[{mimeType:'text/plain',data:'fixture'}],dragOperationsMask:1}};
  assert.throws(()=>validate('Input.dispatchDragEvent',params,{}),/allow-raw-cdp/);
  validate('Input.dispatchDragEvent',params);validate('Input.dispatchDragEvent',{...params,data:{...params.data,files:[]}});
});
test('Protocol review traverses cross-domain refs and finds file fields moved into a new parameter',()=>{
  const protocol={domains:[{domain:'Page',commands:[{name:'futureMethod',parameters:[{name:'payload',$ref:'Shared.Wrapper'}]}]},{domain:'Shared',types:[{id:'Wrapper',type:'object',properties:[{name:'items',type:'array',items:{$ref:'File'}}]},{id:'File',type:'object',properties:[{name:'filePath',type:'string'}]}]}]};
  const report=scanProtocol(protocol);assert.deepEqual(report.needsReview,['Page.futureMethod']);assert.equal(report.candidates[0].fields[0].field,'payload.items[].filePath');
});
test('Protocol review distinguishes guarded file drag from permitted cookie path semantics',()=>{
  const protocol={domains:[{domain:'Input',types:[{id:'Drag',type:'object',properties:[{name:'files',type:'array',items:{type:'string'}}]}],commands:[{name:'dispatchDragEvent',parameters:[{name:'data',$ref:'Drag'}]}]},{domain:'Network',commands:[{name:'setCookie',parameters:[{name:'path',type:'string'}]}]}]};
  const report=scanProtocol(protocol);assert.equal(report.candidates[0].policyBlocked,true);assert.equal(report.candidates[1].policyBlocked,false);assert(report.candidates[1].reviewNotes.length);assert.deepEqual(report.needsReview,[]);
});
test('Protocol review exposes unresolved refs and terminates recursive schema graphs',()=>{
  const protocol={domains:[{domain:'Page',types:[{id:'Recursive',type:'object',properties:[{name:'next',$ref:'Recursive'}]}],commands:[{name:'futureMethod',parameters:[{name:'recursive',$ref:'Recursive'},{name:'unknown',$ref:'Missing'}]}]}]};
  const report=scanProtocol(protocol);assert.deepEqual(report.coverage.unresolvedRefs,['Page.Missing']);assert(report.coverage.cyclesSkipped>0);
  assert.throws(()=>scanProtocol({}),/Missing/);
});
