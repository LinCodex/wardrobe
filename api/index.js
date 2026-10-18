import {handleVercel} from '../runtime/vercel-handler.js';
export default {fetch(request){return handleVercel(request,process.env)}};
