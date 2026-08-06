let activities = [];
let users = [];
let editingUserId = null;


const ROLE_LABEL = {colaborador:'Colaborador de Campo', assistente:'Assistente Social', engenheiro:'Engenheiro'};
const AVATAR_BG  = {colaborador:'#1a7f37', assistente:'#1f6feb', engenheiro:'#9e6a03'};


window.editUser = function(id) {

  const usuario = users.find(u => u.id === id);

  if (!usuario) {
    showToast("Usuário não encontrado.", true);
    return;
  }

  editingUserId = id;

  document.getElementById("new-name").value = usuario.name;
  document.getElementById("new-user").value = usuario.user;
  document.getElementById("new-pass").value = "";
  document.getElementById("new-role").value = usuario.role;

};




window.addUser = async function(){
  const name=document.getElementById('new-name').value.trim();
  const user=document.getElementById('new-user').value.trim();
  const pass=document.getElementById('new-pass').value.trim();
  const role=document.getElementById('new-role').value;
  if (!name || !user || (!editingUserId && !pass)) {
    showToast("Preencha todos os campos!", true);
    return;
  }

  const usuarioDuplicado = users.find(u =>
    u.user === user && u.id !== editingUserId
  );

  if (usuarioDuplicado) {
    showToast("Usuário já existe!", true);
    return;
  }

  const url = editingUserId
    ? `/usuario/${editingUserId}`
    : "/usuario";

  const metodo = editingUserId
    ? "PUT"
    : "POST";

  const res = await fetch(url, {

    method: metodo,

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`
    },

    body: JSON.stringify({

      nome: name,

      usuario: user,

      senha: pass,

      papel: role

    })

  });

  const retorno = await res.json();

  if (!res.ok) {

    showToast(retorno.erro, true);

    return;

  }

  const editando = editingUserId !== null;

  await carregarUsuarios();

  editingUserId = null;

  document.getElementById("new-name").value = "";
  document.getElementById("new-user").value = "";
  document.getElementById("new-pass").value = "";
  document.getElementById("new-role").value = "colaborador";

  showToast(
    editando
      ? "Usuário atualizado!"
      : 'Usuário "' + name + '" cadastrado!'
  );


};


window.toggleUser = function(id){
  const u=users.find(x=>x.id===id);
  if(!u||u.id===currentUser.id){ showToast('Não é possível alterar sua própria conta.',true); return; }
  u.active=!u.active; renderUsersTable(); updateStats();
  showToast(u.active?'Usuário ativado.':'Usuário desativado.');
};
 


window.deleteUser = function(id){

  const u = users.find(x => x.id === id);

  if (!u || u.id === currentUser.id) {
    showToast("Não é possível remover sua própria conta.", true);
    return;
  }

  openConfirm(
    "Remover usuário",
    'Deseja remover "' + u.name + '" permanentemente?',
    async () => {

      try {

        const res = await fetch(`/usuario/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });

        const dados = await res.json();

        if (!res.ok) {
          throw new Error(dados.erro || "Erro ao excluir usuário.");
        }

        users = users.filter(x => x.id !== id);

        renderUsersTable();
        updateStats();

        showToast("Usuário removido.");

      } catch (erro) {

        console.error(erro);

        showToast("Erro ao remover usuário.", true);

      }

    }
  );

};
 
window.togglePass = function(el, pass){
  el.textContent=el.textContent==='••••••'?pass:'••••••';
  if(el.textContent!=='••••••') setTimeout(()=>el.textContent='••••••',3000);
};
 
window.renderUsersTable = function(){
  const q=(document.getElementById('search-user')?.value||'').toLowerCase();
  const filtered=users.filter(u=>u.name.toLowerCase().includes(q)||u.user.toLowerCase().includes(q));
  document.getElementById('users-count').textContent=users.length+' usuário(s) no sistema';
  document.getElementById('users-tbody').innerHTML=filtered.map(u=>`
    <tr>
      <td><div class="td-avatar" style="background:${AVATAR_BG[u.role]||'#1f6feb'}">${u.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div></td>
      <td style="font-weight:500;opacity:${u.active?1:.45}">${u.name}</td>
      <td class="td-user">${u.user}</td>
      <td><span class="role-pill role-${u.role}">${ROLE_LABEL[u.role]}</span></td>
      <td style="font-size:11px;color:${u.active?'#3fb950':'#7d8590'}">${u.active?'✓ Ativo':'✗ Inativo'}</td>
      <td><div class="td-actions">
        <button class="btn btn-primary btn-sm" onclick="editUser(${u.id})">Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleUser(${u.id})">${u.active?'Desativar':'Ativar'}</button>
        <button class="btn btn-red btn-sm" onclick="deleteUser(${u.id})">Remover</button>
      </div></td>
    </tr>`).join('');
};


window.renderActivity = function(){
  const el=document.getElementById('activity-list');
  if(!activities.length){ el.innerHTML='<div style="font-size:13px;color:var(--text2);text-align:center;padding:20px">Nenhuma atividade ainda.</div>'; return; }
  el.innerHTML=activities.slice().reverse().slice(0,10).map(a=>`
    <div class="activity-item">
      <div style="font-size:18px">\u{1F3E0}</div>
      <div class="activity-info"><strong>${a.end}</strong><span>Cadastrado por ${a.colab} · ${a.status}</span></div>
      <div class="activity-time">${a.data} ${a.time||''}</div>
    </div>`).join('');
};


window.confirmarAtribuicao = async function(colaborador){

  try{

    const res = await fetch("/atribuir-casa",{

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({

        casa_id: currentHouse.id,

        colaborador: colaborador

      })

    });

    const retorno = await res.json();

    if(!res.ok){

      showToast(retorno.erro || "Erro ao atribuir!", true);

      return;

    }

    fecharModalAtribuir();

    showToast("Casa atribuída com sucesso!");

  }catch(err){

    console.error(err);

    showToast("Erro ao atribuir!", true);

  }

};


window.carregarListaColaboradores = function() {

  const lista = document.getElementById("lista-colaboradores");

  lista.innerHTML = "";

  const colaboradores = users.filter(
    usuario => usuario.role === "colaborador" && usuario.active
  );

  colaboradores.forEach(usuario => {

    const botao = document.createElement("button");

    botao.className = "btn btn-secondary";

    botao.style.width = "100%";
    botao.style.marginBottom = "8px";
    botao.style.textAlign = "left";

    botao.innerHTML =
      "👤 <b>" + usuario.name + "</b><br><small>" +
      usuario.user +
      "</small>";

    botao.onclick = () => {

      confirmarAtribuicao(usuario.user);

    };

    lista.appendChild(botao);

    document.getElementById("busca-colaborador").oninput = function () {

      const texto = this.value.toLowerCase();

      document.querySelectorAll("#lista-colaboradores button").forEach(botao => {

        if (botao.innerText.toLowerCase().includes(texto)) {

          botao.style.display = "";

        } else {

          botao.style.display = "none";

        }

      });

    };

  });

};


window.fecharModalAtribuir = function(){

  document.getElementById("modal-atribuir").style.display = "none";

};


window.atribuirCasa = function() {

  document.getElementById("modal-atribuir").style.display = "flex";

  carregarListaColaboradores();

};


window.carregarUsuarios = async function() {

  try {

    const token = localStorage.getItem("token");

    const res = await fetch("/usuarios", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Não foi possível carregar os usuários.");
    }

    const lista = await res.json();

    users.length = 0;

    lista.forEach(u => {

      users.push({
        id: u.id,
        name: u.nome,
        user: u.usuario,
        role: u.papel,
        active: u.ativo
      });

    });

    renderUsersTable();

  } catch (erro) {

    console.error("Erro ao carregar usuários:", erro);

  }

};
