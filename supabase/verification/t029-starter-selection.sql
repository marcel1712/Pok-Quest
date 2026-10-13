-- Manual verification for starter selection (T-029). Not run automatically — see
-- t013-completion-idempotency.sql header for why.
--
--   npx supabase db query --linked -f supabase/verification/t029-starter-selection.sql
--
-- Same approach as t028: everything runs in one subtransaction that is always rolled
-- back, because it has to clear the owner's real starter/party to test a fresh choice.
do $$
declare
  test_owner uuid;
  pokemon public.owned_pokemon;
  progress public.game_progress;
  got_error boolean;
begin
  select id into test_owner from auth.users limit 1;

  begin
    delete from public.game_progress where owner_id = test_owner;
    update public.owned_pokemon set party_position = null where owner_id = test_owner;

    -- 1. Without an authenticated user there is nobody to give a starter to.
    set local role authenticated;
    got_error := false;
    begin
      perform public.choose_starter(387);
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: choose_starter worked without a user'; end if;

    perform set_config('request.jwt.claims', json_build_object('sub', test_owner)::text, true);

    -- 2. Only catalog starters can be chosen (399 = Bidoof).
    got_error := false;
    begin
      perform public.choose_starter(399);
    exception when check_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: a non-starter species was accepted'; end if;

    -- 3. A valid choice creates a level-5 Pokémon in the first party slot and records it.
    pokemon := public.choose_starter(387);
    if pokemon.pokedex_number != 387 or pokemon.level != 5 or pokemon.xp != 125
      or pokemon.party_position is distinct from 1 or pokemon.owner_id != test_owner then
      raise exception 'FAIL: unexpected starter row %', pokemon;
    end if;
    select * into progress from public.game_progress;
    if progress.starter_pokedex_number is distinct from 387
      or progress.starter_owned_pokemon_id is distinct from pokemon.id then
      raise exception 'FAIL: starter choice not recorded correctly: %', progress;
    end if;

    -- 4. The choice is final: neither the same nor another starter can be chosen again,
    --    and the failed attempts create no extra Pokémon.
    got_error := false;
    begin
      perform public.choose_starter(390);
    exception when unique_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: a second starter was accepted'; end if;

    got_error := false;
    begin
      perform public.choose_starter(387);
    exception when unique_violation then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: the same starter was granted twice'; end if;

    if (select count(*) from public.owned_pokemon where pokedex_number in (387, 390, 393) and level = 5) != 1 then
      raise exception 'FAIL: expected exactly one starter Pokémon after the retries';
    end if;
    if (select starter_pokedex_number from public.game_progress) != 387 then
      raise exception 'FAIL: the recorded starter changed';
    end if;

    -- 5. The client cannot rewrite or erase the choice directly.
    got_error := false;
    begin
      update public.game_progress set starter_pokedex_number = 393;
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could update game_progress'; end if;

    got_error := false;
    begin
      delete from public.game_progress;
    exception when insufficient_privilege then got_error := true;
    end;
    if not got_error then raise exception 'FAIL: authenticated could delete game_progress'; end if;

    reset role;
    raise exception 'T029_ROLLBACK';
  exception when others then
    reset role;
    if sqlerrm = 'T029_ROLLBACK' then
      raise notice 'PASS: starter selection rules hold (all test data rolled back)';
    else
      raise;
    end if;
  end;
end $$;
